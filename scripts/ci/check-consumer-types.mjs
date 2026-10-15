import { execFileSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * What a consumer installs besides the SDK: its peer dependency `vue`, and a compiler. The fixture
 * gets these with everything they depend on, as an install would, since type-checking their
 * declarations reaches into those too.
 */
const CONSUMER_DEPENDENCIES = ['vue', 'typescript'];

/** `names` and every package they depend on, transitively, as installed in this repository. */
export function dependencyClosure(names, nodeModules = join(ROOT, 'node_modules')) {
    const found = new Set();
    const queue = [...names];

    while (queue.length) {
        const name = queue.shift();
        const manifest = join(nodeModules, name, 'package.json');
        if (found.has(name) || !existsSync(manifest)) continue;
        found.add(name);
        queue.push(...Object.keys(JSON.parse(readFileSync(manifest, 'utf-8')).dependencies ?? {}));
    }

    return [...found].sort();
}

/**
 * One per kind of consumer: a bundler, and Node's own resolution with the package's declarations
 * type-checked as well, which is what a consumer without `skipLibCheck` gets.
 */
const CONSUMER_CONFIGS = ['tsconfig.json', 'tsconfig.nodenext.json'];

/**
 * The diagnostics in `output` that are this package's to fix: those in the fixture or in the SDK's
 * declarations. Checking libraries also reports errors inside third-party declarations, which a
 * consumer gets with or without this SDK.
 */
export function ownDiagnostics(output) {
    const diagnostics = output.split(/\n(?=\S)/).filter(Boolean);
    return diagnostics
        .filter(
            (diagnostic) =>
                !diagnostic.startsWith('node_modules/') ||
                diagnostic.startsWith('node_modules/@solvimon/solvimon-web/'),
        )
        .join('\n');
}

/**
 * Type-checks a fixture consumer against the packed tarball.
 *
 * The fixture is built outside the repository on purpose. Node resolves from the real path of a
 * file, so a fixture inside the repo — or symlinked into it — walks up into the repo's own
 * `node_modules` and finds `@solvimon/solvimon-types`, which no consumer can install. Checking
 * there would prove nothing: the published types would look resolvable when they are not.
 *
 * @param {{ keep?: boolean }} [options]
 * @returns {{ ok: boolean, output: string, dir: string }}
 */
export function checkConsumerTypes({ keep = false } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'solvimon-consumer-types-'));

    try {
        const packageDir = join(dir, 'node_modules', '@solvimon', 'solvimon-web');
        mkdirSync(packageDir, { recursive: true });

        // `npm pack` is what makes this a test of the published package rather than of `dist/`:
        // it applies `files` and `exports`, so anything left out of the tarball fails here.
        const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', dir], {
            cwd: ROOT,
            encoding: 'utf-8',
        }).trim();

        execFileSync('tar', ['-xzf', join(dir, tarball), '-C', packageDir, '--strip-components=1']);

        for (const dependency of dependencyClosure(CONSUMER_DEPENDENCIES)) {
            cpSync(join(ROOT, 'node_modules', dependency), join(dir, 'node_modules', dependency), {
                recursive: true,
                dereference: true,
            });
        }

        for (const file of readdirSync(join(ROOT, 'tests/consumer-types'))) {
            cpSync(join(ROOT, 'tests/consumer-types', file), join(dir, file));
        }

        const failures = [];
        for (const config of CONSUMER_CONFIGS) {
            try {
                execFileSync(join(dir, 'node_modules/typescript/bin/tsc'), ['-p', config], {
                    cwd: dir,
                    encoding: 'utf-8',
                    stdio: 'pipe',
                });
            } catch (error) {
                const output = ownDiagnostics(`${error.stdout ?? ''}${error.stderr ?? ''}`.trim());
                if (output) failures.push(`${config}:\n${output}`);
            }
        }

        return { ok: failures.length === 0, output: failures.join('\n\n'), dir };
    } finally {
        if (!keep) rmSync(dir, { recursive: true, force: true });
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { ok, output } = checkConsumerTypes();

    if (ok) {
        console.log('The published types check out for a consumer without the private packages.');
        process.exit(0);
    }

    console.error('A consumer of the published package does not get the types it should:\n');
    console.error(output);
    console.error(
        [
            '',
            'Every line in tests/consumer-types/consumer.ts without a `@ts-expect-error` has to',
            'compile, and every line with one has to fail. An "unused @ts-expect-error" means a',
            'mistake that used to be caught no longer is — usually because a declaration stopped',
            'resolving and quietly became `any`.',
        ].join('\n'),
    );
    process.exit(1);
}
