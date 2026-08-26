import { readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { resolveSafePath } from '../safe-path.mjs';

/**
 * Static `import ... from "x"`, bare `import "x"` and `export ... from "x"`.
 * Dynamic `import("x")` does not match: `(` is not whitespace, so the quote never
 * follows the keyword directly.
 */
const STATIC_IMPORT = /(?:from|import)\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']/g;

export function dirSize(path) {
    let total = 0;
    try {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
            const full = join(path, entry.name);
            total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
        }
    } catch {
        // directory doesn't exist
    }
    return total;
}

/**
 * Extracts the import specifiers of a built ES module.
 *
 * @param {string} code
 * @returns {{ staticImports: string[], dynamicImports: string[] }}
 */
export function parseImports(code) {
    const staticImports = new Set();
    const dynamicImports = new Set();
    for (const [, spec] of code.matchAll(STATIC_IMPORT)) staticImports.add(spec);
    for (const [, spec] of code.matchAll(DYNAMIC_IMPORT)) dynamicImports.add(spec);
    return { staticImports: [...staticImports], dynamicImports: [...dynamicImports] };
}

/**
 * Resolves a relative import to a file inside `distDir`, or null when it points
 * outside the bundle (bare specifiers like `vue`, or a missing file).
 */
function resolveChunk(fromFile, spec, distDir) {
    if (!spec.startsWith('.')) return null;
    let resolved;
    try {
        // Resolve against cwd first: `resolveSafePath` treats a relative path as relative
        // to `distDir`, which would prefix it twice when `distDir` is itself relative.
        resolved = resolveSafePath(resolve(join(dirname(fromFile), spec)), distDir);
    } catch {
        return null; // escapes distDir — not part of the shipped graph
    }
    try {
        return statSync(resolved).isFile() ? resolved : null;
    } catch {
        return null;
    }
}

function readChunk(file) {
    try {
        return readFileSync(file, 'utf8');
    } catch {
        return '';
    }
}

/**
 * Walks the module graph from `entryFile` and sums the bytes a consumer downloads.
 *
 * `eager` is the transitive closure of static imports — everything fetched before the
 * component can render. `lazy` is everything reachable only through a dynamic import
 * (Adyen, translations), counted once and never double-counted against eager.
 *
 * @returns {{ eager: number, lazy: number }}
 */
export function measureEntryGraph(entryFile, distDir) {
    const eager = new Set();
    const lazySeeds = new Set();

    const queue = [entryFile];
    while (queue.length > 0) {
        const file = queue.pop();
        if (eager.has(file)) continue;
        eager.add(file);

        const { staticImports, dynamicImports } = parseImports(readChunk(file));
        for (const spec of staticImports) {
            const chunk = resolveChunk(file, spec, distDir);
            if (chunk) queue.push(chunk);
        }
        for (const spec of dynamicImports) {
            const chunk = resolveChunk(file, spec, distDir);
            if (chunk) lazySeeds.add(chunk);
        }
    }

    // A chunk reachable both ways is already paid for eagerly, so it is skipped here.
    const lazy = new Set();
    const lazyQueue = [...lazySeeds];
    while (lazyQueue.length > 0) {
        const file = lazyQueue.pop();
        if (eager.has(file) || lazy.has(file)) continue;
        lazy.add(file);

        const { staticImports, dynamicImports } = parseImports(readChunk(file));
        for (const spec of [...staticImports, ...dynamicImports]) {
            const chunk = resolveChunk(file, spec, distDir);
            if (chunk) lazyQueue.push(chunk);
        }
    }

    const sum = (files) =>
        [...files].reduce((total, file) => {
            try {
                return total + statSync(file).size;
            } catch {
                return total;
            }
        }, 0);

    return { eager: sum(eager), lazy: sum(lazy) };
}

function findEsmEntry(dir) {
    try {
        const name = readdirSync(dir).find((file) => file.endsWith('.mjs'));
        return name ? join(dir, name) : null;
    } catch {
        return null;
    }
}

/**
 * @returns {{ total: number, entries: Record<string, { eager: number, lazy: number }> }}
 *   `total` is the published package size on disk; per-entry sizes are what a consumer
 *   of that entry actually downloads, including shared chunks.
 */
export function measureBundle(distDir = 'dist') {
    const entries = {};
    for (const section of ['screens', 'components']) {
        let names;
        try {
            names = readdirSync(join(distDir, section));
        } catch {
            continue; // section doesn't exist
        }
        for (const name of names) {
            const entryFile = findEsmEntry(join(distDir, section, name));
            entries[`${section}/${name}`] = entryFile
                ? measureEntryGraph(entryFile, distDir)
                : { eager: 0, lazy: 0 };
        }
    }
    return { total: dirSize(distDir), entries };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { measureConsumerBundles } = await import('./measure-consumer-bundle.mjs');
    const result = measureBundle();
    const consumer = await measureConsumerBundles('dist');
    for (const [key, entry] of Object.entries(result.entries)) {
        entry.consumer = consumer[key] ?? null;
    }
    console.log(JSON.stringify(result));
}
