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
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
        // Required for symlinked local packages to resolve subpath exports correctly
        preserveSymlinks: true,
    },
    server: {
        watch: {
            followSymlinks: true,
        },
    },
});
