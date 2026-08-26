import { mkdtempSync, writeFileSync, rmSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import { brotliCompressSync } from 'zlib';

/**
 * Consumers install this package and import it, so their bundler flattens our chunk
 * layout and tree-shakes it again. Measuring `dist` therefore only bounds what they
 * ship. This builds a throwaway app against each entry the way a consumer would, and
 * measures the result — the bytes that actually reach a browser.
 */

/**
 * Resolves vite from the project rather than from this file, so the script still works
 * when CI copies it outside the repo to measure the base branch.
 */
async function loadVite(projectRoot) {
    const require = createRequire(join(projectRoot, 'noop.js'));
    return import(pathToFileURL(require.resolve('vite')).href);
}

/**
 * Sums the chunks reachable from the entry through static imports. Dynamically imported
 * chunks are left out: they survive the consumer's bundler as separate requests, which
 * is the whole point of loading them lazily.
 *
 * @param {Array<{ type: string, fileName: string, code?: string, imports?: string[], isEntry?: boolean }>} chunks
 * @returns {{ raw: number, brotli: number, chunks: number }}
 */
export function sumEagerChunks(chunks) {
    const byName = new Map();
    for (const chunk of chunks) {
        if (chunk.type === 'chunk') byName.set(chunk.fileName, chunk);
    }

    const entry = chunks.find((chunk) => chunk.type === 'chunk' && chunk.isEntry);
    if (!entry) return { raw: 0, brotli: 0, chunks: 0 };

    const eager = new Set();
    const queue = [entry.fileName];
    while (queue.length > 0) {
        const name = queue.pop();
        if (eager.has(name) || !byName.has(name)) continue;
        eager.add(name);
        for (const imported of byName.get(name).imports ?? []) queue.push(imported);
    }

    let raw = 0;
    let brotli = 0;
    for (const name of eager) {
        const code = Buffer.from(byName.get(name).code ?? '', 'utf8');
        raw += code.length;
        brotli += brotliCompressSync(code).length;
    }
    return { raw, brotli, chunks: eager.size };
}

/**
 * Bundles a single entry the way a consumer would and measures the eager output.
 * Returns null when the build fails, so one broken entry cannot fail the whole report.
 */
export async function measureConsumerBundle(entryFile, projectRoot) {
    const { build } = await loadVite(projectRoot);
    const scratch = mkdtempSync(join(tmpdir(), 'consumer-bundle-'));
    try {
        const app = join(scratch, 'app.js');
        // Absolute: the app lives in a temp directory, so a relative path would read as a
        // bare specifier and fail to resolve. Bind the namespace to a global so nothing is
        // dropped as unused.
        writeFileSync(
            app,
            `import * as sdk from ${JSON.stringify(resolve(entryFile))};\nglobalThis.__sdk = sdk;\n`,
            'utf-8',
        );

        const result = await build({
            root: projectRoot,
            configFile: false,
            logLevel: 'silent',
            build: {
                write: false,
                outDir: join(scratch, 'out'),
                lib: { entry: app, formats: ['es'], fileName: () => 'app.js' },
                // `vue` is a peer dependency, so a consumer already has it.
                rollupOptions: { external: ['vue'] },
            },
        });

        const outputs = Array.isArray(result) ? result : [result];
        return sumEagerChunks(outputs[0]?.output ?? []);
    } catch (error) {
        // Reported rather than thrown: one unbuildable entry should not cost the whole
        // report, but it must not vanish either.
        console.warn(`Consumer build failed for ${entryFile}: ${error.message}`);
        return null;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
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
 * @returns {Promise<Record<string, { raw: number, brotli: number, chunks: number } | null>>}
 */
export async function measureConsumerBundles(distDir, projectRoot = process.cwd()) {
    const results = {};
    for (const section of ['screens', 'components']) {
        const sectionDir = join(distDir, section);
        if (!existsSync(sectionDir)) continue;
        for (const name of readdirSync(sectionDir)) {
            const entryFile = findEsmEntry(join(sectionDir, name));
            results[`${section}/${name}`] = entryFile
                ? await measureConsumerBundle(entryFile, projectRoot)
                : null;
        }
    }
    return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const distArg = args[args.indexOf('--dist') + 1];
    const dist = args.includes('--dist') ? distArg : 'dist';
    console.log(JSON.stringify(await measureConsumerBundles(dist)));
}
