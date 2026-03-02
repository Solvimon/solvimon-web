import { fileURLToPath, URL } from 'node:url';
import { resolve, relative, dirname } from 'node:path';
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';
import string from 'vite-plugin-string';
import type { ElementNode, AttributeNode, TemplateChildNode, RootNode } from '@vue/compiler-core';

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
            entry: { ...legacyEntries, ...screenEntries },
            formats: ['es', 'cjs'],
            fileName: (format, name) =>
                `${name.replace(/^[/\\]+/, '').replace('.ce', '')}.${format}.js`,
        },
        rollupOptions: {
            external: ['vue', '@solvimon/ui', '@solvimon/types'],
            output: {
                preserveModules: false,
                strict: false, // Setting to make sure cjs exports work (for next.js/webpack outputs)
                globals: {
                    vue: 'Vue',
                    '@solvimon/ui': 'SolvimonUI',
                    '@solvimon/types': 'SolvimonTypes',
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
            include: ['src/entries/**/*.ce.ts', 'src/public/screens/**/*.entry.ce.ts'],
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
        setupFiles: ['vitest-localstorage-mock'],
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

        const elementNode = node as ElementNode;
        elementNode.props = elementNode.props.filter((prop) => {
            if (prop.type === 6) {
                const attrNode = prop as AttributeNode;
                return !ATTRIBUTES_TO_REMOVE.includes(attrNode.name);
            }
            return true;
        });
    };
}
