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
