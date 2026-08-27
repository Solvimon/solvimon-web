import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { resolveSafePath } from '../safe-path.mjs';

/**
 * Types the published declarations may still reach in a package a consumer cannot install.
 *
 * `@solvimon/solvimon-ui` lives in a private registry, and unlike `@solvimon/solvimon-types` it
 * cannot be vendored into the package: its declarations reach `@vuelidate/core`, `vue-router`,
 * `@tiptap/core` and five more packages this one does not depend on, so bringing them along would
 * trade one unresolvable import for eight. The three names below are reachable only through the
 * internal provider props, which no host writes, so they resolve to `any` without consequence.
 *
 * Adding a name here is a decision, not a formality. Anything a host does write — a `configuration`
 * option, a portal object, a mount config — must resolve, because an option typed `any` is what let
 * DD-3333 ship.
 */
export const ALLOWED_UNRESOLVABLE_TYPES = {
    '@solvimon/solvimon-ui': ['BrandProviderProps', 'IntlMessages', 'IntlProviderProps'],
};

/** Any specifier a declaration file names, relative or bare. */
const SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
/** Named imports only — the shape the emitted declarations always use. */
const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

/** `@scope/name/deep/path` and `name/deep/path` both name a package a consumer has to have. */
export function packageNameOf(specifier) {
    const segments = specifier.split('/');
    return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/** What a consumer gets when they install this package, and so what its declarations may name. */
export function resolvablePackages(packageJson) {
    return new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.peerDependencies ?? {}),
    ]);
}

/** The declaration files `package.json` points a consumer at. */
export function publicEntryPoints(distDir) {
    const entries = [
        join(distDir, 'index.d.ts'),
        join(distDir, 'core/index.d.ts'),
        join(distDir, 'core/action-request.types.d.ts'),
    ];

    for (const group of ['screens', 'components']) {
        const groupDir = join(distDir, group);
        if (!existsSync(groupDir)) continue;
        for (const name of readdirSync(groupDir)) {
            entries.push(join(groupDir, name, `${name}.ce.d.ts`));
        }
    }

    return entries.filter((file) => existsSync(file));
}

function resolveDeclaration(fromFile, specifier, distDir) {
    const base = resolveSafePath(join(relative(distDir, dirname(fromFile)), specifier), distDir);
    for (const candidate of [`${base}.d.ts`, join(base, 'index.d.ts')]) {
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

/**
 * Walks every declaration a consumer can reach from the published entry points, collecting the
 * types each bare specifier names and the relative ones that lead nowhere.
 *
 * @returns {{ files: string[], imported: Record<string, string[]>, dangling: string[] }}
 */
export function collectExternalTypes(distDir) {
    const seen = new Set();
    const imported = new Map();
    const dangling = new Set();

    const walk = (file) => {
        if (seen.has(file) || !existsSync(file)) return;
        seen.add(file);

        const source = readFileSync(file, 'utf-8');

        for (const [, names, specifier] of source.matchAll(NAMED_IMPORT)) {
            if (specifier.startsWith('.')) continue;
            const pkg = packageNameOf(specifier);
            if (!imported.has(pkg)) imported.set(pkg, new Set());
            for (const name of names.split(',')) {
                // `X as Y` is still a reference to X.
                const importedName = name
                    .trim()
                    .replace(/^type\s+/, '')
                    .split(/\s+as\s+/)[0];
                if (importedName) imported.get(pkg).add(importedName);
            }
        }

        for (const [, specifier] of source.matchAll(SPECIFIER)) {
            if (!specifier.startsWith('.')) continue;
            const next = resolveDeclaration(file, specifier, distDir);
            if (next) {
                walk(next);
            } else {
                dangling.add(`${relative(distDir, file)} -> ${specifier}`);
            }
        }
    };

    publicEntryPoints(distDir).forEach(walk);

    return {
        files: [...seen].sort(),
        imported: Object.fromEntries(
            [...imported].map(([pkg, names]) => [pkg, [...names].sort()]).sort(),
        ),
        dangling: [...dangling].sort(),
    };
}

/**
 * @returns {{ ok: boolean, unexpected: Record<string, string[]>, dangling: string[], stale: Record<string, string[]> }}
 *   `unexpected` names types a consumer cannot resolve and the allowlist does not cover, and
 *   `dangling` lists imports inside the package that lead nowhere — both failures. `stale` is what
 *   the allowlist covers but nothing reaches any more.
 */
export function checkPublishedTypes(distDir = 'dist', packageJson = {}) {
    const resolvable = resolvablePackages(packageJson);
    const { imported, dangling } = collectExternalTypes(distDir);
    const unexpected = {};
    const stale = {};

    for (const [pkg, names] of Object.entries(imported)) {
        if (resolvable.has(pkg)) continue;
        const allowed = ALLOWED_UNRESOLVABLE_TYPES[pkg] ?? [];
        const beyond = names.filter((name) => !allowed.includes(name));
        if (beyond.length) unexpected[pkg] = beyond;
    }

    for (const [pkg, allowed] of Object.entries(ALLOWED_UNRESOLVABLE_TYPES)) {
        const unused = allowed.filter((name) => !(imported[pkg] ?? []).includes(name));
        if (unused.length) stale[pkg] = unused;
    }

    return {
        ok: Object.keys(unexpected).length === 0 && dangling.length === 0,
        unexpected,
        dangling,
        stale,
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const distDir = resolve('dist');

    if (!existsSync(join(distDir, 'index.d.ts'))) {
        console.error('No published declarations found in dist/. Run `npm run build` first.');
        process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    const { ok, unexpected, dangling, stale } = checkPublishedTypes(distDir, packageJson);

    for (const [pkg, names] of Object.entries(stale)) {
        console.log(`Allowlisted but no longer reachable in ${pkg}: ${names.join(', ')}`);
    }

    if (ok) {
        console.log('Published declarations resolve, and name nothing a consumer cannot.');
        process.exit(0);
    }

    if (dangling.length) {
        console.error('Published declarations import files the package does not contain:\n');
        for (const entry of dangling) {
            console.error(`  ${entry}`);
        }
        console.error(
            [
                '',
                'Each of these resolves to `any` for a consumer — silently, because consumers build',
                'with `skipLibCheck`. Usually it means a declaration was not emitted, or was emitted',
                'somewhere other than where the import points.',
                '',
            ].join('\n'),
        );
    }

    if (Object.keys(unexpected).length) {
        console.error('Published declarations name types a consumer cannot resolve:\n');
        for (const [pkg, names] of Object.entries(unexpected)) {
            console.error(`  ${pkg}: ${names.join(', ')}`);
        }
        console.error(
            [
                '',
                'That package is neither a dependency nor a peer dependency of this one, so each of',
                'these resolves to `any` for a consumer — silently, because consumers build with',
                '`skipLibCheck`.',
                '',
                'Vendor the package into the published declarations the way `vite.config.ts` does',
                'for @solvimon/solvimon-types, declare the type in src/public/types/, or, if nothing',
                'a host writes goes through it, add it to ALLOWED_UNRESOLVABLE_TYPES in this script.',
            ].join('\n'),
        );
    }

    process.exit(1);
}
