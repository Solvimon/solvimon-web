import { lstatSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

const rootDir = fileURLToPath(new URL('./', import.meta.url));
const nodeModulesDir = fileURLToPath(new URL('./node_modules', import.meta.url));

// A secondary checkout usually links node_modules to the main one. Vite serves only files under
// the workspace root, so without this every setup file behind that link fails to load.
const linkedNodeModules = lstatSync(nodeModulesDir, { throwIfNoEntry: false })?.isSymbolicLink()
    ? [realpathSync(nodeModulesDir)]
    : [];

export default mergeConfig(
    viteConfig({ command: 'serve', mode: 'test' }),
    defineConfig({
        server: {
            fs: {
                allow: [searchForWorkspaceRoot(rootDir), ...linkedNodeModules],
            },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            exclude: [...configDefaults.exclude, 'tests/playwright/**', '**/config.test.ts'],
            root: rootDir,
            // `.sdk/tailwind.css` is emitted by `npm run build:css` and is not in the repository,
            // so importing it fails wherever that build has not run — a fresh clone, and the CI
            // test jobs. Nothing here asserts on the generated CSS, so the suite resolves it to an
            // empty stylesheet instead of depending on a build artifact.
            alias: [
                {
                    find: /(?:\.\.\/)*\.sdk\/tailwind\.css/,
                    replacement: fileURLToPath(
                        new URL('./src/test-utils/generatedStyles.css', import.meta.url),
                    ),
                },
            ],
            server: {
                deps: {
                    inline: ['@solvimon/solvimon-ui'],
                },
            },
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json-summary'],
                reportsDirectory: './coverage',
                include: ['src/**/*.ts', 'src/**/*.vue'],
                exclude: [
                    'src/**/*.d.ts',
                    'src/**/*.spec.ts',
                    'src/**/*.test.ts',
                    'src/types/**',
                    'src/entries/**',
                    'src/index.ts',
                ],
            },
        },
    }),
);
