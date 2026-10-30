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
import type { Plugin, PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import { invalidateTypeCache } from 'vue/compiler-sfc';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';
import type { TemplateChildNode, RootNode } from '@vue/compiler-core';
import { selectorsMissingFrom } from './scripts/css-duplication.mjs';
import { bundledUnscannedUiFiles, missingUiDirs } from './scripts/tailwind-content.mjs';
import { ICON_SPRITE_MODULE, subsetIconSprite } from './scripts/icon-sprite.mjs';

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

/** Dropped from the published bundle only: a test run that cannot log is a test run debugged blind. */
const PRODUCTION_DROPS: ('console' | 'debugger')[] = ['console', 'debugger'];

/**
 * Whether BETA and DEV resolve to real configuration, opted into with
 * `SOLVIMON_INTERNAL_ENVIRONMENTS=1` for the playground, the e2e test app and `npm run watch`.
 *
 * Off by default so that the artifact `npm run build` produces is the publishable one. A forgotten
 * variable then costs a developer their DEV environment locally, rather than shipping internal
 * hostnames to every customer.
 */
const withInternalEnvironments = process.env.SOLVIMON_INTERNAL_ENVIRONMENTS === '1';

/** The modules a source imports for their types alone — what `defineProps<…>()` is resolved from. */
const TYPE_IMPORT =
    /import\s+type\s[^;]*?from\s*['"]([^'"]+)['"]|import\s*\{[^}]*\btype\s[^}]*\}\s*from\s*['"]([^'"]+)['"]/g;

/**
 * Keeps `vite build --watch` compiling components against the types as they are now.
 *
 * The SFC compiler caches the files `defineProps<…>()` and `defineEmits<…>()` resolve their types
 * from, and @vitejs/plugin-vue only clears that cache on a dev server's hot update. A watch build —
 * `npm run watch`, which a linked Desk runs on — kept the types it first read for as long as it ran:
 * a component rebuilt after a prop was added was compiled without it, so the prop never arrived
 * and whatever it showed was silently gone.
 *
 * So a component's type imports are watched, followed through the type files they import in turn,
 * and a changed file is dropped from the cache before the rebuild reads it. A component recompiles
 * once its own source changes too, as it does along with any prop it uses: plugin-vue keeps the
 * compiled script of an unchanged component, which is out of reach here.
 */
function refreshVueTypesInWatch(): Plugin {
    return {
        name: 'solvimon:refresh-vue-types-in-watch',
        apply: 'build',
        watchChange(id) {
            invalidateTypeCache(id);
        },
        async transform(_code, id) {
            // The component itself, read from disk: by now its type imports are compiled away.
            if (!this.meta.watchMode || !id.endsWith('.vue')) return null;

            const seen = new Set<string>();
            const follow = async (source: string, importer: string): Promise<void> => {
                for (const [, typeOnly, mixed] of source.matchAll(TYPE_IMPORT)) {
                    const resolved = await this.resolve(typeOnly ?? mixed, importer);
                    const file = resolved?.id.split('?')[0];

                    if (!file || seen.has(file) || file.includes('/node_modules/')) continue;
                    if (!/\.(ts|vue)$/.test(file) || !existsSync(file)) continue;

                    seen.add(file);
                    this.addWatchFile(file);
                    if (file.endsWith('.ts')) await follow(readFileSync(file, 'utf8'), file);
                }
            };

            await follow(readFileSync(id, 'utf8'), id);
            return null;
        },
    };
}

/**
 * Removes the stylesheet vite extracts from the library build.
 *
 * Every component renders in a shadow root, which a stylesheet on the host page cannot reach, so
 * styles are adopted as strings instead (see `src/utils/customElements.ts`). The extracted file is
 * the discarded half of the Solvimon UI components importing their styles twice — once as a side
 * effect, once as a string. Nothing in `dist` references it, no `exports` entry makes it
 * importable, and a consumer who found it anyway would download bytes that style nothing.
 *
 * It is deleted only after checking it is wholly redundant. If a dependency ever ships styles the
 * plain way alone, those rules would be the one copy there is, and dropping them would quietly
 * unstyle a component — so that case fails the build instead.
 */
function dropRedundantStylesheet(): PluginOption {
    return {
        name: 'solvimon:drop-redundant-stylesheet',
        // After vite's own css plugin, which is what emits the asset in the first place.
        enforce: 'post',
        generateBundle(_options, bundle) {
            const js = Object.values(bundle)
                .filter((output) => output.type === 'chunk')
                .map((output) => output.code)
                .join('\n');

            for (const [fileName, output] of Object.entries(bundle)) {
                if (output.type !== 'asset' || !fileName.endsWith('.css')) continue;

                const css = String(output.source);
                const missing = selectorsMissingFrom(css, js);

                if (missing.length) {
                    this.error(
                        [
                            `${fileName} holds ${missing.length} rule(s) that reach no shadow root:`,
                            ...missing.slice(0, 10).map((selector) => `    ${selector}`),
                            '',
                            'These styles exist only in a stylesheet no consumer can import, so the',
                            'components they target render unstyled. Whatever ships them needs to',
                            'expose them as a string that `baseStyles` can adopt, the way',
                            '`@solvimon/solvimon-ui/component-styles` does, before this file can go.',
                        ].join('\n'),
                    );
                }

                delete bundle[fileName];
            }
        },
    };
}

/**
 * Fails the build when it bundles a solvimon-ui file Tailwind does not scan for classes (see
 * `scripts/tailwind-content.mjs`): that component's classes would be missing from every entry's
 * stylesheet, and it would render unstyled.
 */
function requireScannedUiFiles(): Plugin {
    return {
        name: 'solvimon:require-scanned-ui-files',
        buildStart() {
            const missing = missingUiDirs(
                resolve(__dirname, 'node_modules/@solvimon/solvimon-ui/dist'),
            );

            if (missing.length) {
                this.warn(
                    [
                        'UI_DIRS_NOT_SCANNED in scripts/tailwind-content.mjs lists directories solvimon-ui no longer has:',
                        ...missing.map((dir) => `    ${dir}`),
                        '',
                        'Remove them, and list their new location if it is still unbundled.',
                    ].join('\n'),
                );
            }
        },
        generateBundle(_options, bundle) {
            const moduleIds = Object.values(bundle).flatMap((output) =>
                output.type === 'chunk' ? Object.keys(output.modules) : [],
            );
            const unscanned = bundledUnscannedUiFiles(moduleIds);

            if (unscanned.length) {
                this.error(
                    [
                        'These solvimon-ui files are bundled, but Tailwind does not scan them for classes:',
                        ...unscanned.map((id) => `    ${id}`),
                        '',
                        'Remove their directory from UI_DIRS_NOT_SCANNED in scripts/tailwind-content.mjs.',
                    ].join('\n'),
                );
            }
        },
    };
}

/**
 * Cuts solvimon-ui's icon sprite down to the icons this build can render (see
 * `scripts/icon-sprite.mjs`). Every mount fetches the sprite, and most of its icons are desk's.
 */
function subsetIconSpritePlugin(): Plugin {
    return {
        name: 'solvimon:subset-icon-sprite',
        renderChunk(code, chunk, _options, meta) {
            const spriteId = chunk.moduleIds.find((id) => ICON_SPRITE_MODULE.test(id));
            if (!spriteId) return null;

            const otherCode = Object.values(meta.chunks)
                .flatMap((other) => other.moduleIds)
                .filter((id) => id !== spriteId)
                .map((id) => this.getModuleInfo(id)?.code ?? '')
                .join('\n');
            const subset = subsetIconSprite(code, otherCode);

            if (!subset) {
                this.warn(`Kept the whole icon sprite: ${spriteId} holds no sprite this can read.`);
                return null;
            }

            this.info(
                `Icon sprite: kept ${subset.kept.length} icons, dropped the ${subset.dropped.length} that no code names.`,
            );
            return { code: subset.code, map: null };
        },
    };
}

const coreEntry = resolve(__dirname, 'src/public/core/index.ts');
const rootEntry = resolve(__dirname, 'src/index.ts');

/**
 * `mode` is what decides whether this build is the published one: `vite build` runs in production
 * mode, `vitest` and `vite build --mode development` do not. Keying off it keeps `console` and the
 * test ids in everything a developer runs, and out of everything a customer installs.
 */
export default defineConfig(({ mode }) => {
    const isProduction = mode === 'production';

    return {
        esbuild: { drop: isProduction ? PRODUCTION_DROPS : [] },
        build: {
            minify: 'esbuild',
            outDir: fileURLToPath(new URL('./dist', import.meta.url)),
            chunkSizeWarningLimit: 1000,
            lib: {
                entry: {
                    index: rootEntry,
                    ...screenEntries,
                    ...componentEntries,
                    core: coreEntry,
                },
                formats: ['es'],
                // `.mjs` tells node these are ES modules without the package declaring a `type`.
                fileName: (_format, name) =>
                    name === 'core'
                        ? 'core/index.mjs'
                        : `${name.replace(/^[/\\]+/, '').replace('.ce', '')}.mjs`,
            },
            rollupOptions: {
                external: ['vue'],
                output: {
                    preserveModules: false,
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
                        nodeTransforms: [removeAttributes(isProduction)],
                    },
                },
            }),
            refreshVueTypesInWatch(),
            dropRedundantStylesheet(),
            requireScannedUiFiles(),
            subsetIconSpritePlugin(),
            dts({
                bundleTypes: false,
                outDirs: './dist',
                include: [
                    'env.d.ts',
                    'src/types/**/*.ts',
                    'src/public/types/**/*.ts',
                    'src/**/*.types.ts',
                    'src/translations/supported.js',
                    'src/public/screens/types.ts',
                    'src/config/**/*.ts',
                    'src/components/providers/**/*.ts',
                    'src/components/providers/**/*.vue',
                    'src/index.ts',
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
                // Build output the source imports, such as `.sdk/tailwind.css`.
                { find: '@sdk', replacement: fileURLToPath(new URL('./.sdk', import.meta.url)) },
                { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
            ],
        },
        test: {
            setupFiles: ['./vitest.setup.ts', 'vitest-localstorage-mock'],
        },
    };
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
function publishDeclarations(): Plugin {
    const outDir = fileURLToPath(new URL('./dist', import.meta.url));
    /** Where the emitted tree lives once it has been moved out of `dist/src`. */
    const treeDir = 'types';
    /** Where declarations copied from a package a consumer cannot install go, inside that tree. */
    const VENDOR_DIR = 'vendor';
    const PRIVATE_TYPES_PACKAGE = '@solvimon/solvimon-types';
    const UI_PACKAGE = '@solvimon/solvimon-ui';
    const ADYEN_PACKAGE = '@adyen/adyen-web';
    /** The `@solvimon/solvimon-ui` declarations the public types reach, under its `dist/src`. */
    const UI_DECLARATIONS = [
        'components/providers/BrandProvider/BrandProvider.types.d.ts',
        'components/providers/IntlProvider/IntlProvider.types.d.ts',
    ];

    /** The relative specifier `file` imports `target` by, `target` given without extension. */
    const specifierFrom = (file: string, target: string) => {
        const path = relative(dirname(file), target).replace(/\\/g, '/');
        return path.startsWith('.') ? path : `./${path}`;
    };

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

        // `WithOnlyOptionalProperties` passes `Optional` one type argument where it takes two, an
        // error every consumer that type-checks libraries sees. Nothing uses it; this gives it
        // the meaning its name states.
        const utilsPath = resolve(vendorDir, 'utils.d.ts');
        writeFileSync(
            utilsPath,
            readFileSync(utilsPath, 'utf8').replace(
                '[P in keyof T]: Optional<T[P]>;',
                '[P in keyof T]?: T[P];',
            ),
        );

        rewriteDeclarations(treeRoot, (source, file) =>
            // Two files inside the package import it by name rather than relatively, so this also
            // resolves the vendored copy's references to itself.
            source.replaceAll(
                `'${PRIVATE_TYPES_PACKAGE}'`,
                `'${specifierFrom(file, resolve(vendorDir, 'index'))}'`,
            ),
        );
    };

    /**
     * `@solvimon/solvimon-ui` cannot be vendored whole: its declarations reach eight packages this
     * one does not depend on. The public types reach only the provider props below, which import
     * nothing, so those files are copied and every import naming only their types points at the
     * copy.
     */
    const vendorUiTypes = (treeRoot: string) => {
        const vendorDir = resolve(treeRoot, VENDOR_DIR, UI_PACKAGE);
        const sourceDir = resolve(
            realpathSync(resolve(__dirname, 'node_modules', UI_PACKAGE)),
            'dist/src',
        );
        const vendored = new Set<string>();

        for (const declaration of UI_DECLARATIONS) {
            const source = readFileSync(resolve(sourceDir, declaration), 'utf8');
            if (/^\s*import\s/m.test(source)) {
                throw new Error(
                    `${UI_PACKAGE}'s ${declaration} now imports other modules, so copying it alone would leave those unresolved.`,
                );
            }
            mkdirSync(dirname(resolve(vendorDir, declaration)), { recursive: true });
            writeFileSync(resolve(vendorDir, declaration), source);
            for (const [, name] of source.matchAll(
                /^export (?:declare )?(?:interface|type) (\w+)/gm,
            )) {
                vendored.add(name);
            }
        }

        writeFileSync(
            resolve(vendorDir, 'index.d.ts'),
            UI_DECLARATIONS.map(
                (file) => `export * from './${file.replace(/\.d\.ts$/, '')}';\n`,
            ).join(''),
        );

        pointImportsAtVendored(treeRoot, UI_PACKAGE, vendored, vendorDir);
    };

    /**
     * `@adyen/adyen-web` is bundled, so a consumer never runs an installed copy; the published
     * types only name two of its string unions. They are generated from the installed package's
     * declarations, so they match the bundled version, and Adyen need not be a dependency.
     */
    const vendorAdyenTypes = (treeRoot: string) => {
        const vendorDir = resolve(treeRoot, VENDOR_DIR, ADYEN_PACKAGE);
        const source = readFileSync(
            resolve(__dirname, 'node_modules', ADYEN_PACKAGE, 'dist/es/index.d.ts'),
            'utf8',
        );
        const resultCode = /^type ResultCode = ([^;]+);$/m.exec(source)?.[1];
        const actionTypes = /^declare const actionTypes: \{\n([\s\S]*?)\n\};$/m.exec(source)?.[1];
        const actionNames = [...(actionTypes ?? '').matchAll(/^\s+readonly (\w+):/gm)].map(
            ([, name]) => `'${name}'`,
        );
        if (!resultCode || !actionNames.length) {
            throw new Error(
                `Could not find ResultCode and the action types in ${ADYEN_PACKAGE}'s declarations.`,
            );
        }

        mkdirSync(vendorDir, { recursive: true });
        writeFileSync(
            resolve(vendorDir, 'index.d.ts'),
            `export type ResultCode = ${resultCode};\nexport type PaymentActionsType = ${actionNames.join(' | ')};\n`,
        );

        pointImportsAtVendored(
            treeRoot,
            ADYEN_PACKAGE,
            new Set(['ResultCode', 'PaymentActionsType']),
            vendorDir,
        );
    };

    /**
     * Points every import from `pkg` that names only `vendored` types at the copy in `vendorDir`.
     * Imports of anything else stay as they are; `types:check-published` fails if a consumer can
     * reach one.
     */
    const pointImportsAtVendored = (
        treeRoot: string,
        pkg: string,
        vendored: Set<string>,
        vendorDir: string,
    ) => {
        const statement = new RegExp(
            `(import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+)'${pkg.replace(/[/.-]/g, '\\$&')}'`,
            'g',
        );
        rewriteDeclarations(treeRoot, (source, file) =>
            source.replace(statement, (match, head: string, names: string) => {
                const imported = names
                    .split(',')
                    .map(
                        (name) =>
                            name
                                .trim()
                                .replace(/^type\s+/, '')
                                .split(/\s+as\s+/)[0],
                    )
                    .filter(Boolean);
                return imported.every((name) => vendored.has(name))
                    ? `${head}'${specifierFrom(file, resolve(vendorDir, 'index'))}'`
                    : match;
            }),
        );
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

            // Vendoring copies the types into `.sdk` inside the repository, which vite-plugin-dts
            // watches, so in watch mode every build would set off the next one. A watch build only
            // feeds local development, where the private types package resolves on its own.
            if (!this.meta.watchMode) {
                vendorPrivateTypes(publishedTreeDir);
                vendorUiTypes(publishedTreeDir);
                vendorAdyenTypes(publishedTreeDir);
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

const ATTRIBUTES_TO_REMOVE = ['data-testid'];

/**
 * Automatically remove all `data-testid` attributes for production builds.
 *
 * Both spellings: a static `data-testid` is an attribute node, a bound `:data-testid` is a `bind`
 * directive, and leaving the second kind in shipped every id a template computes.
 */
function removeAttributes(isProduction = false) {
    return (node: TemplateChildNode | RootNode) => {
        if (node.type !== 1 || !isProduction) {
            return;
        }

        node.props = node.props.filter((prop) => {
            if (prop.type === 6) {
                return !ATTRIBUTES_TO_REMOVE.includes(prop.name);
            }

            const boundName = prop.name === 'bind' && prop.arg?.type === 4 ? prop.arg.content : '';

            return !ATTRIBUTES_TO_REMOVE.includes(boundName);
        });
    };
}
