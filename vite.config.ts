import { fileURLToPath, URL } from 'node:url';
import { resolve, relative, dirname } from 'node:path';
import { copyFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';
import string from 'vite-plugin-string';
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
        string({
            include: ['**/*.css'],
        }),
        vueDevTools(),
        dts({
            rollupTypes: false,
            outDir: './dist',
            include: [
                'env.d.ts',
                'src/types/**/*.d.ts',
                'src/index.ts',
                'src/entries/**/*.ce.ts',
                'src/public/screens/**/*.entry.ce.ts',
                'src/public/components/**/*.entry.ce.ts',
                'src/public/core/**/*.ts',
            ],
            exclude: ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**'],
            copyDtsFiles: false,
        }),
        copyEntryDeclarations(),
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
 * Copy generated .d.ts from dist/src/entries/ into the same folders as the built JS
 * (dist/EntryName/ for legacy entries, dist/screens/X/ for screen entries).
 */
function copyEntryDeclarations() {
    const outDir = fileURLToPath(new URL('./dist', import.meta.url));
    return {
        name: 'copy-entry-declarations',
        closeBundle() {
            // Component entries: copy from dist/src/entries/X/X.ce.d.ts to dist/X/X.ce.d.ts
            for (const entryKey of Object.keys(legacyEntries)) {
                const srcPath = resolve(outDir, 'src/entries', `${entryKey}.ce.d.ts`);
                const outPath = resolve(outDir, `${entryKey}.ce.d.ts`);
                if (existsSync(srcPath)) {
                    mkdirSync(dirname(outPath), { recursive: true });
                    copyFileSync(srcPath, outPath);
                }
            }
            // Screen entries: copy from dist/src/public/screens/X/X.entry.ce.d.ts to dist/screens/X/X.ce.d.ts
            for (const entryKey of Object.keys(screenEntries)) {
                const match = /^screens\/([^/]+)\//.exec(entryKey);
                if (!match) continue;
                const screenName = match[1];
                const srcPath = resolve(
                    outDir,
                    'src/public/screens',
                    screenName,
                    `${screenName}.entry.ce.d.ts`,
                );
                const outPath = resolve(outDir, 'screens', screenName, `${screenName}.ce.d.ts`);
                if (existsSync(srcPath)) {
                    mkdirSync(dirname(outPath), { recursive: true });
                    copyFileSync(srcPath, outPath);
                }
            }
            // Component entries: copy from dist/src/public/components/X/X.entry.ce.d.ts to dist/components/X/X.ce.d.ts
            for (const entryKey of Object.keys(componentEntries)) {
                const match = /^components\/([^/]+)\//.exec(entryKey);
                if (!match) continue;
                const componentName = match[1];
                const srcPath = resolve(
                    outDir,
                    'src/public/components',
                    componentName,
                    `${componentName}.entry.ce.d.ts`,
                );
                const outPath = resolve(
                    outDir,
                    'components',
                    componentName,
                    `${componentName}.ce.d.ts`,
                );
                if (existsSync(srcPath)) {
                    mkdirSync(dirname(outPath), { recursive: true });
                    copyFileSync(srcPath, outPath);
                }
            }
            // Core entry: copy all .d.ts from dist/src/public/core/ to dist/core/
            const coreSrcDir = resolve(outDir, 'src/public/core');
            const coreOutDir = resolve(outDir, 'core');
            if (existsSync(coreSrcDir)) {
                mkdirSync(coreOutDir, { recursive: true });
                for (const name of readdirSync(coreSrcDir)) {
                    if (name.endsWith('.d.ts')) {
                        copyFileSync(resolve(coreSrcDir, name), resolve(coreOutDir, name));
                    }
                }
            }

            // Root entry: copy dist/src/index.d.ts to dist/index.d.ts
            const rootSrcPath = resolve(outDir, 'src/index.d.ts');
            const rootOutPath = resolve(outDir, 'index.d.ts');
            if (existsSync(rootSrcPath)) {
                copyFileSync(rootSrcPath, rootOutPath);
            }

            // Remove dist/src (vite-plugin-dts output) now that declarations are copied
            const srcDir = resolve(outDir, 'src');
            if (existsSync(srcDir)) {
                rmSync(srcDir, { recursive: true });
            }
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
