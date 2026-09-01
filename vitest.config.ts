import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            globals: true,
            exclude: [...configDefaults.exclude, 'tests/playwright/**', '**/config.test.ts'],
            root: fileURLToPath(new URL('./', import.meta.url)),
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
