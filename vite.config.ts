import { fileURLToPath, URL } from 'node:url';
import { resolve, relative, dirname } from 'node:path';
import {
    mkdirSync,
    existsSync,
    rmSync,
    readdirSync,
    readFileSync,
    writeFileSync,
    renameSync,
} from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';
import type { TemplateChildNode, RootNode } from '@vue/compiler-core';

function getLibEntries(
    basePath: string,
    globPattern: string,
    extensionRegex: RegExp,
    keyPrefix = '',
): Record<string, string> {
    const baseDir = resolve(__dirname, basePath);
    return glob.sync(resolve(baseDir, globPattern)).reduce<Record<string, string>>((acc, file) => {
        const relativePath = relative(baseDir, file);
        const entryName = relativePath.replace(extensionRegex, '').replace(/^[/\\]+/, '');
        acc[`${keyPrefix}${entryName}`] = file;
        return acc;
    }, {});
}

const legacyEntries = getLibEntries('src/entries', '**/*.ce.ts', /\.ce\.ts$/, '');

const screenEntries = getLibEntries(
    'src/public/screens',
    '**/*.entry.ce.ts',
    /\.entry\.ce\.ts$/,
    'screens/',
);

const componentEntries = getLibEntries(
    'src/public/components',
    '**/*.entry.ce.ts',
    /\.entry\.ce\.ts$/,
    'components/',
);

const coreEntry = resolve(__dirname, 'src/public/core/index.ts');
const rootEntry = resolve(__dirname, 'src/index.ts');

export default defineConfig({
    build: {
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
        },
        outDir: fileURLToPath(new URL('./dist', import.meta.url)),
        chunkSizeWarningLimit: 1000,
        lib: {
            entry: {
                index: rootEntry,
                ...legacyEntries,
                ...screenEntries,
                ...componentEntries,
                core: coreEntry,
            },
            formats: ['es', 'cjs'],
            fileName: (format, name) =>
                name === 'core'
                    ? `core/index.${format}.js`
                    : `${name.replace(/^[/\\]+/, '').replace('.ce', '')}.${format}.js`,
        },
        rollupOptions: {
            external: ['vue'],
            output: {
                preserveModules: false,
                strict: false, // Setting to make sure cjs exports work (for next.js/webpack outputs)
                globals: {
                    vue: 'Vue',
                },
                // No manual vendor chunk: forcing all of solvimon-ui into one chunk made
                // every entry import the union of what all entries use. Rollup already
                // hoists shared modules on its own, per set of entries that use them.
            },
        },
    },
    plugins: [
        vue({
            features: { customElement: true },
            template: {
                compilerOptions: {
                    nodeTransforms: [removeAttributes(process.env.ENVIRONMENT === 'LIVE')],
                },
            },
        }),
        vueDevTools(),
        dts({
            rollupTypes: false,
            outDir: './dist',
            include: [
                'env.d.ts',
                'src/types/**/*.ts',
                // Every type module the public entry props reach through, so the published
                // declarations resolve instead of quietly falling back to `any`.
                'src/**/*.types.ts',
                'src/index.ts',
                'src/entries/**/*.ce.ts',
                'src/public/screens/**/*.entry.ce.ts',
                'src/public/components/**/*.entry.ce.ts',
                'src/public/core/**/*.ts',
            ],
            exclude: ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**'],
            copyDtsFiles: false,
        }),
        publishDeclarations(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        setupFiles: ['./vitest.setup.ts', 'vitest-localstorage-mock'],
    },
});

/**
 * Turn the declarations vite-plugin-dts emits into declarations a consumer can actually resolve.
 *
 * The emitted tree mirrors `src/`, so every file in it imports its neighbours by a path that is
 * only correct inside that tree. Copying single files out of it to the paths `package.json` points
 * at broke each of those imports, and because consumers build with `skipLibCheck` the breakage was
 * swallowed and the types silently degraded to `any`. So the tree is published as-is under
 * `dist/types/`, and every published path becomes a one-line re-export of the file inside it.
 */
function publishDeclarations() {
    const outDir = fileURLToPath(new URL('./dist', import.meta.url));
    /** Where the emitted tree lives once it has been moved out of `dist/src`. */
    const treeDir = 'types';

    /** `dist/a/b/c.d.ts` re-exporting `dist/types/x/y.d.ts` needs `../../types/x/y`. */
    const writeShim = (outPath: string, treeModule: string) => {
        const upToDist = relative(dirname(outPath), outDir) || '.';
        const specifier = `${upToDist}/${treeDir}/${treeModule}`.replace(/\\/g, '/');
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, `export * from '${specifier}';\n`);
    };

    /**
     * TypeScript writes `vue` as a path into `node_modules` because `tsconfig.json` maps it there,
     * and that path does not exist in a consumer's tree. Point it back at the bare package, which
     * every consumer has as a peer dependency.
     */
    const rewriteVueImports = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const entryPath = resolve(dir, entry.name);
            if (entry.isDirectory()) {
                rewriteVueImports(entryPath);
            } else if (entry.name.endsWith('.d.ts')) {
                const source = readFileSync(entryPath, 'utf8');
                const rewritten = source.replace(
                    /(['"])(?:\.\.\/)+node_modules\/vue\/dist\/vue\.d\.ts\1/g,
                    "'vue'",
                );
                if (rewritten !== source) {
                    writeFileSync(entryPath, rewritten);
                }
            }
        }
    };

    return {
        name: 'publish-declarations',
        closeBundle() {
            const emittedDir = resolve(outDir, 'src');
            if (!existsSync(emittedDir)) {
                return;
            }

            const publishedTreeDir = resolve(outDir, treeDir);
            rmSync(publishedTreeDir, { recursive: true, force: true });
            renameSync(emittedDir, publishedTreeDir);
            rewriteVueImports(publishedTreeDir);

            // Legacy entries: dist/X/X.ce.d.ts
            for (const entryKey of Object.keys(legacyEntries)) {
                writeShim(resolve(outDir, `${entryKey}.ce.d.ts`), `entries/${entryKey}.ce`);
            }

            // Screen and component entries: dist/screens/X/X.ce.d.ts, dist/components/X/X.ce.d.ts
            for (const entryKey of [
                ...Object.keys(screenEntries),
                ...Object.keys(componentEntries),
            ]) {
                const match = /^(screens|components)\/([^/]+)\//.exec(entryKey);
                if (!match) continue;
                const [, group, name] = match;
                writeShim(
                    resolve(outDir, group, name, `${name}.ce.d.ts`),
                    `public/${group}/${name}/${name}.entry.ce`,
                );
            }

            // Core entry: one shim per emitted core declaration, so deep imports keep working.
            const coreTreeDir = resolve(publishedTreeDir, 'public/core');
            if (existsSync(coreTreeDir)) {
                for (const name of readdirSync(coreTreeDir)) {
                    if (name.endsWith('.d.ts')) {
                        const moduleName = name.slice(0, -'.d.ts'.length);
                        writeShim(resolve(outDir, 'core', name), `public/core/${moduleName}`);
                    }
                }
            }

            // Root entry: dist/index.d.ts
            writeShim(resolve(outDir, 'index.d.ts'), 'index');
        },
    };
}

/**
 * Automatically remove all `data-testid` attributes for production builds.
 */
function removeAttributes(isProduction = false) {
    return (node: TemplateChildNode | RootNode) => {
        const ATTRIBUTES_TO_REMOVE = ['data-testid'];

        if (node.type !== 1 || !isProduction) {
            return;
        }

        node.props = node.props.filter((prop) => {
            if (prop.type === 6) {
                return !ATTRIBUTES_TO_REMOVE.includes(prop.name);
            }
            return true;
        });
    };
}
