import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        outDir: fileURLToPath(new URL('./dist', import.meta.url)),
        lib: {
            entry: [
                resolve(__dirname, 'src/entries/index.ts'),
                ...glob.sync(resolve(__dirname, 'src/entries/**/*.ce.ts')),
            ],
            formats: ['es', 'cjs'],
            fileName: (format, name) => `${name.replace('.ce', '')}.${format}.js`,
        },
        rollupOptions: {
            output: {
                strict: false, // Setting to make sure cjs exports work (for next.js/webpack outputs)
            },
        },
    },
    plugins: [
        vue({ features: { customElement: true } }),
        vueDevTools(),
        dts({ rollupTypes: true }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
