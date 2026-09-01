import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Fails the build when the published bundle names internal infrastructure.
 *
 * The alias in `vite.config.ts` keeps `src/config/internalEnvironments.ts` out of the module graph
 * unless `SOLVIMON_INTERNAL_ENVIRONMENTS=1` is set, so in principle nothing here can leak. This is
 * the check that says so out loud: a build flag set by accident, a hostname pasted into a public
 * config, or a new internal environment wired up the old way all show up here rather than on npm.
 *
 * The forbidden hosts are read from the internal config sources rather than listed, so adding an
 * environment extends this check without anyone remembering to.
 */

/** Config modules whose hostnames a customer is allowed to receive. */
const PUBLIC_CONFIGS = ['config.live.ts', 'config.test.ts'];

/** Host and port of the e2e test app, which `global.config.ts` holds for both sides to share. */
function testAppOrigin(repoRoot) {
    const source = readFileSync(join(repoRoot, 'global.config.ts'), 'utf-8');
    const host = source.match(/TEST_APP_HOST\s*=\s*['"]([^'"]+)['"]/)?.[1];
    const port = source.match(/TEST_APP_PORT\s*=\s*(\d+)/)?.[1];
    return host && port ? [`${host}:${port}`] : [];
}

/**
 * Every literal host named by a config module that is not public — `https://dev.solvimon.com:10016`
 * yields `dev.solvimon.com:10016`. Template placeholders are skipped: they carry no hostname of
 * their own, and what they interpolate is covered by `testAppOrigin`.
 */
export function internalHosts(configSources) {
    const hosts = new Set();
    for (const source of Object.values(configSources)) {
        for (const [, host] of source.matchAll(/https?:\/\/([^/'"`\s]+)/g)) {
            if (!host.includes('${')) hosts.add(host);
        }
    }
    return [...hosts];
}

/** Reads the non-public config modules, keyed by filename. */
export function readInternalConfigs(configDir) {
    const sources = {};
    for (const name of readdirSync(configDir)) {
        if (!name.startsWith('config.') || !name.endsWith('.ts')) continue;
        if (PUBLIC_CONFIGS.includes(name)) continue;
        sources[name] = readFileSync(join(configDir, name), 'utf-8');
    }
    return sources;
}

/** Every file under `dir`, recursively. */
export function walk(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(full));
        else if (statSync(full).isFile()) files.push(full);
    }
    return files;
}

/**
 * Finds `needles` in the files under `distDir`.
 *
 * @returns {{ needle: string, files: string[] }[]} one entry per needle that appears at all
 */
export function findInBundle(distDir, needles) {
    if (!needles.length) return [];

    const hits = new Map(needles.map((needle) => [needle, []]));

    for (const file of walk(distDir)) {
        let content;
        try {
            content = readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const needle of needles) {
            if (content.includes(needle)) hits.get(needle).push(relative(distDir, file));
        }
    }

    return [...hits]
        .filter(([, files]) => files.length)
        .map(([needle, files]) => ({ needle, files }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const distDir = join(repoRoot, 'dist');
    const configDir = join(repoRoot, 'src/config');

    if (!existsSync(distDir)) {
        console.error('No dist/ to check. Run `npm run build` first.');
        process.exit(1);
    }

    if (process.env.SOLVIMON_INTERNAL_ENVIRONMENTS === '1') {
        console.error(
            [
                'SOLVIMON_INTERNAL_ENVIRONMENTS=1 is set, so this dist/ deliberately contains the',
                'internal environments and must not be published. Rebuild without it before',
                'checking, or publishing.',
            ].join('\n'),
        );
        process.exit(1);
    }

    const forbidden = [
        ...internalHosts(readInternalConfigs(configDir)),
        ...testAppOrigin(repoRoot),
    ];
    const found = findInBundle(distDir, forbidden);

    // The alias swaps a module out; an alias pointed at the wrong path would swap out everything
    // and leave a bundle that leaks nothing because it configures nothing.
    const publicHosts = internalHosts({
        public: PUBLIC_CONFIGS.map((name) => readFileSync(join(configDir, name), 'utf-8')).join(
            '\n',
        ),
    });
    const missing = publicHosts.filter((host) => !findInBundle(distDir, [host]).length);

    if (!found.length && !missing.length) {
        console.log(
            `Bundle names no internal infrastructure (checked ${forbidden.length} hosts across dist/).`,
        );
        process.exit(0);
    }

    if (found.length) {
        console.error('The published bundle names internal infrastructure:\n');
        for (const { needle, files } of found) {
            console.error(`  ${needle}`);
            for (const file of files) console.error(`    dist/${file}`);
        }
        console.error(
            [
                '',
                'These hosts come from a config module that the published build is supposed to alias',
                'away. Check `resolve.alias` in vite.config.ts, and that the environment reaching',
                'them is registered in src/config/internalEnvironments.ts rather than src/config/lib.ts.',
            ].join('\n'),
        );
    }

    if (missing.length) {
        console.error(
            [
                '',
                `The bundle is missing the public hosts it should have: ${missing.join(', ')}.`,
                'That usually means the internalEnvironments alias is matching more than it should.',
            ].join('\n'),
        );
    }

    process.exit(1);
}
