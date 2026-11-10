import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { collectExternalTypes } from './check-published-types.mjs';

/**
 * Freezes the public type surface: every declaration a consumer can reach from the published entry
 * points, in one committed file. CI rebuilds it and fails on any difference, so a change to what a
 * host can write — an option renamed, a type narrowed, a vendored type that moved with a bump of
 * `@solvimon/solvimon-types` — shows up in the diff, where review sees it. `--update` rewrites it on
 * purpose.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SNAPSHOT_PATH = join(ROOT, 'api', 'public-api.snap');

/** One section per declaration file, by its path in `dist`, so the order never depends on the walk. */
export function renderSnapshot(distDir) {
    return collectExternalTypes(distDir)
        .files.map((file) => relative(distDir, file).split('\\').join('/'))
        .sort()
        .map((path) => {
            const source = readFileSync(join(distDir, path), 'utf-8')
                .replace(/^\/\/# sourceMappingURL=.*$/gm, '')
                .replace(/[ \t]+$/gm, '')
                .trimEnd();
            return `// ${path}\n${source}\n`;
        })
        .join('\n');
}

/** The paths whose section was added, removed or changed between two snapshots. */
export function changedSections(before, after) {
    const sections = (snapshot) =>
        new Map(
            snapshot
                .split(/^(?=\/\/ \S+\.d\.ts$)/m)
                .filter(Boolean)
                .map((section) => [section.slice(3, section.indexOf('\n')), section.trim()]),
        );
    const was = sections(before);
    const is = sections(after);

    return [...new Set([...was.keys(), ...is.keys()])]
        .filter((path) => was.get(path) !== is.get(path))
        .sort()
        .map(
            (path) =>
                `${was.has(path) ? (is.has(path) ? 'changed' : 'removed') : 'added'}: ${path}`,
        );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const snapshot = renderSnapshot(join(ROOT, 'dist'));

    if (process.argv.includes('--update')) {
        writeFileSync(SNAPSHOT_PATH, snapshot);
        console.log(`Wrote ${relative(ROOT, SNAPSHOT_PATH)}.`);
        process.exit(0);
    }

    const committed = existsSync(SNAPSHOT_PATH) ? readFileSync(SNAPSHOT_PATH, 'utf-8') : '';
    if (committed === snapshot) {
        console.log('The public type surface matches api/public-api.snap.');
        process.exit(0);
    }

    console.error('The public type surface differs from api/public-api.snap:\n');
    for (const line of changedSections(committed, snapshot)) console.error(`  ${line}`);
    console.error(
        [
            '',
            'After 1.0 a change here can break a host. If it is intended, run',
            '`npm run build && npm run api:update`, commit the snapshot, and say in the pull request',
            'what changed for hosts.',
        ].join('\n'),
    );
    process.exit(1);
}
