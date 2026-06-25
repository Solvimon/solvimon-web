import { fileURLToPath, URL } from 'node:url';
import fs from 'fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';


const SSL_CERT_DIR = './.cert';
const SSL_CERT_FILE = `${SSL_CERT_DIR}/cert.pem`;
const SSL_KEY_FILE = `${SSL_CERT_DIR}/dev.pem`;

const HTTPS_CONFIG =
    fs.existsSync(SSL_CERT_FILE) && fs.existsSync(SSL_KEY_FILE)
        ? {
              cert: SSL_CERT_FILE,
              key: SSL_KEY_FILE,
          }
        : false;

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
        host: 'portal.local',
        port: 5175,
        https: HTTPS_CONFIG || undefined,
        fs: {
            allow: ['..'],
        },
        watch: {
            followSymlinks: true,
        },
    },
});
