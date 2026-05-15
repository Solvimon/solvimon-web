import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag.startsWith('solvimon-'),
                },
            },
        }),
        vueDevTools(),
        basicSsl(),
    ],
    resolve: {
        alias: [
            // Resolve the SDK core directly from source so playground changes are
            // reflected immediately without rebuilding the dist.
            {
                find: '@solvimon/solvimon-web/core',
                replacement: fileURLToPath(new URL('../src/public/core/index.ts', import.meta.url)),
            },
            // The SDK source files use @/ as their src alias — map it to the SDK src.
            // The playground itself uses only relative imports, so there is no conflict.
            {
                find: '@',
                replacement: fileURLToPath(new URL('../src', import.meta.url)),
            },
        ],
        // Required for symlinked local packages to resolve subpath exports correctly
        preserveSymlinks: true,
    },
    server: {
        fs: {
            allow: ['..'],
        },
        watch: {
            followSymlinks: true,
        },
    },
});
