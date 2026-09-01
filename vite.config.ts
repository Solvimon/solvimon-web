import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { resolve, relative, dirname, sep } from 'node:path';
import {
    cpSync,
    statSync,
    mkdtempSync,
    realpathSync,
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

/**
 * Extensions that state the format outright, so node reads each entry as what it is without the
 * package declaring a `type`. Rollup already names shared chunks this way; the entries did not.
 */
const MODULE_EXTENSIONS: Record<string, string> = { es: 'mjs', cjs: 'cjs' };

/**
 * Whether BETA and DEV resolve to real configuration, opted into with
 * `SOLVIMON_INTERNAL_ENVIRONMENTS=1` for the playground, the e2e test app and `npm run watch`.
 *
 * Off by default so that the artifact `npm run build` produces is the publishable one. A forgotten
 * variable then costs a developer their DEV environment locally, rather than shipping internal
 * hostnames to every customer.
 */
const withInternalEnvironments = process.env.SOLVIMON_INTERNAL_ENVIRONMENTS === '1';

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
            fileName: (format, name) => {
                const extension = MODULE_EXTENSIONS[format] ?? `${format}.js`;

                return name === 'core'
                    ? `core/index.${extension}`
                    : `${name.replace(/^[/\\]+/, '').replace('.ce', '')}.${extension}`;
            },
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
                // The public type contract, and every type module the public entry props reach
                // through, so the published declarations resolve instead of quietly falling back
                // to `any`.
                'src/public/types/**/*.ts',
                'src/**/*.types.ts',
                // Modules those type files import from that are not themselves `*.types.ts`.
                // Kept to the ones that resolve on their own: chasing the rest would mean emitting
                // declarations for all of `src`, and nothing a consumer writes goes through them.
                'src/translations/supported.js',
                'src/public/screens/types.ts',
                'src/config/**/*.ts',
                'src/components/providers/**/*.ts',
                'src/components/providers/**/*.vue',
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
        // Array form, most specific first: the first match wins, and a bare '@' would otherwise
        // swallow '@/config/internalEnvironments' before it could be redirected.
        alias: [
            ...(withInternalEnvironments
                ? []
                : [
                      {
                          find: '@/config/internalEnvironments',
                          replacement: fileURLToPath(
                              new URL(
                                  './src/config/internalEnvironments.published.ts',
                                  import.meta.url,
                              ),
                          ),
                      },
                  ]),
            { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        ],
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
    /** Where declarations copied from a package a consumer cannot install go, inside that tree. */
    const VENDOR_DIR = 'vendor';
    const PRIVATE_TYPES_PACKAGE = '@solvimon/solvimon-types';

    /** `dist/a/b/c.d.ts` re-exporting `dist/types/x/y.d.ts` needs `../../types/x/y`. */
    const writeShim = (outPath: string, treeModule: string) => {
        const upToDist = relative(dirname(outPath), outDir) || '.';
        const specifier = `${upToDist}/${treeDir}/${treeModule}`.replace(/\\/g, '/');
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, `export * from '${specifier}';\n`);
    };

    /** Applies `rewrite` to every declaration under `dir`. */
    const rewriteDeclarations = (
        dir: string,
        rewrite: (source: string, file: string) => string,
    ) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const entryPath = resolve(dir, entry.name);
            if (entry.isDirectory()) {
                rewriteDeclarations(entryPath, rewrite);
            } else if (entry.name.endsWith('.d.ts')) {
                const source = readFileSync(entryPath, 'utf8');
                const rewritten = rewrite(source, entryPath);
                if (rewritten !== source) {
                    writeFileSync(entryPath, rewritten);
                }
            }
        }
    };

    /**
     * TypeScript writes `vue` as a path into `node_modules` because `tsconfig.json` maps it there,
     * and that path does not exist in a consumer's tree. Point it back at the bare package, which
     * every consumer has as a peer dependency.
     */
    const rewriteVueImports = (source: string) =>
        source.replace(/(['"])(?:\.\.\/)+node_modules\/vue\/dist\/vue\.d\.ts\1/g, "'vue'");

    /**
     * `@solvimon/solvimon-types` is published to a registry consumers cannot reach, so a
     * declaration that imports from it by name resolves to `any` on their side — silently, since
     * they build with `skipLibCheck`. Emit the package's declarations into the published tree and
     * point every import at that copy instead.
     *
     * Its own declarations are emitted rather than its files copied: the package ships `.ts`, and
     * `skipLibCheck` does not cover `.ts`, so shipping the source would hand every consumer's
     * compiler a few thousand lines to type-check under settings we do not control.
     */
    const vendorPrivateTypes = (treeRoot: string) => {
        const vendorDir = resolve(treeRoot, VENDOR_DIR, PRIVATE_TYPES_PACKAGE);
        const packageDir = realpathSync(resolve(__dirname, 'node_modules', PRIVATE_TYPES_PACKAGE));

        // TypeScript treats anything under `node_modules` as an external library and emits nothing
        // for it, so the sources are copied out first. Copying also makes this behave the same
        // whether the package is a registry install or a symlinked local checkout. The copy sits
        // inside the repository so that what the package imports — `@adyen/adyen-web`, and itself —
        // still resolves through the repository's own `node_modules`.
        mkdirSync(resolve(__dirname, '.sdk'), { recursive: true });
        const sourceDir = mkdtempSync(resolve(__dirname, '.sdk', 'vendor-types-'));

        try {
            cpSync(packageDir, sourceDir, {
                recursive: true,
                dereference: true,
                // Relative to the package, not absolute: an installed package lives under
                // `node_modules` itself, so testing the absolute path would skip every file in it
                // and leave `tsc` an empty directory.
                filter: (path) => !relative(packageDir, path).split(sep).includes('node_modules'),
            });

            if (!existsSync(resolve(sourceDir, 'index.ts'))) {
                throw new Error(
                    `Copied no sources out of ${packageDir}; there is nothing to emit declarations from.`,
                );
            }

            try {
                execFileSync(
                    resolve(__dirname, 'node_modules/.bin/tsc'),
                    [
                        '--declaration',
                        '--emitDeclarationOnly',
                        '--skipLibCheck',
                        '--strict',
                        '--target',
                        'esnext',
                        '--module',
                        'esnext',
                        '--moduleResolution',
                        'bundler',
                        '--rootDir',
                        sourceDir,
                        '--outDir',
                        vendorDir,
                        resolve(sourceDir, 'index.ts'),
                    ],
                    { stdio: 'pipe', encoding: 'utf8' },
                );
            } catch (error) {
                // Without this the failure reads only as "Command failed", which says nothing
                // about which declaration would not emit.
                const output = ['stdout', 'stderr']
                    .map((stream) => String(Reflect.get(Object(error), stream) ?? ''))
                    .join('')
                    .trim();

                throw new Error(
                    `Could not emit declarations for ${PRIVATE_TYPES_PACKAGE}:\n${output || String(error)}`,
                );
            }
            // Declarations the package already ships are not re-emitted by tsc, so they would be
            // missing from the copy — `utils.d.ts`, which two dozen of its own types import.
            cpSync(sourceDir, vendorDir, {
                recursive: true,
                filter: (path) => statSync(path).isDirectory() || path.endsWith('.d.ts'),
            });
        } finally {
            rmSync(sourceDir, { recursive: true, force: true });
        }

        rewriteDeclarations(treeRoot, (source, file) => {
            const toVendor = relative(dirname(file), resolve(vendorDir, 'index'));
            const specifier = (toVendor.startsWith('.') ? toVendor : `./${toVendor}`).replace(
                /\\/g,
                '/',
            );
            // Two files inside the package import it by name rather than relatively, so this also
            // resolves the vendored copy's references to itself.
            return source.replaceAll(`'${PRIVATE_TYPES_PACKAGE}'`, `'${specifier}'`);
        });
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
            rewriteDeclarations(publishedTreeDir, rewriteVueImports);
            vendorPrivateTypes(publishedTreeDir);

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
