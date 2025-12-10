import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { glob } from 'glob';
import dts from 'vite-plugin-dts';
import string from 'vite-plugin-string';

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
            entry: [
                resolve(__dirname, 'src/entries/index.ts'),
                ...glob.sync(resolve(__dirname, 'src/entries/**/*.ce.ts')),
            ],
            formats: ['es', 'cjs'],
            fileName: (format, name) => `${name.replace('.ce', '')}.${format}.js`,
        },
        rollupOptions: {
            external: ['vue', '@solvimon/ui', '@solvimon/types'],
            output: {
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
        vue({ features: { customElement: true } }),
        string({
            include: ['**/*.css'],
        }),
        vueDevTools(),
        dts({ rollupTypes: true }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
