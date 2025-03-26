import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path';

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { glob } from 'glob'
import dts from 'vite-plugin-dts';

// https://vite.dev/config/
export default defineConfig({
  build: {
    minify: false,
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    lib: {
      entry: glob.sync(resolve(__dirname, 'src/entries/**/*.ce.ts')),
      formats: ['es'],
      fileName: (format, name) => `${name.replace('.ce', '')}.js`,
    },
    rollupOptions: {
      output: {
        preserveModules: false
      }
    }
  },
  plugins: [
    vue({
      features: {
        customElement: true
      }
    }),
    vueDevTools(),
    dts({ rollupTypes: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  
})
