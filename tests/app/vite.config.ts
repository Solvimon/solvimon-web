import { fileURLToPath, URL } from 'node:url';
import { resolve, dirname } from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { TEST_APP_HOST, TEST_APP_PORT } from '../../global.config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SSL_CERT_DIR = resolve(__dirname, '.cert');
const SSL_CERT_FILE = resolve(SSL_CERT_DIR, 'cert.pem');
const SSL_KEY_FILE = resolve(SSL_CERT_DIR, 'dev.pem');

const HTTPS_CONFIG =
    fs.existsSync(SSL_CERT_FILE) && fs.existsSync(SSL_KEY_FILE)
        ? {
              cert: fs.readFileSync(SSL_CERT_FILE),
              key: fs.readFileSync(SSL_KEY_FILE),
          }
        : undefined;

export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag.includes('solvimon-'),
                },
            },
        }),
    ],
    server: {
        proxy: {
            ...getProxyConfig('/identity'),
            ...getProxyConfig('/config'),
            ...getProxyConfig('/transaction'),
            ...getProxyConfig('/event'),
        },
        https: HTTPS_CONFIG,
        host: TEST_APP_HOST,
        port: TEST_APP_PORT,
        strictPort: true,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});

function getProxyConfig(targetPath: '/identity' | '/config' | '/transaction' | '/event') {
    return {
        [targetPath]: {
            target:
                targetPath === '/identity'
                    ? 'https://identity.solvimon.com/v1'
                    : 'https://test.api.solvimon.com/v1',
            changeOrigin: true,
            secure: false,
            rewrite: (path: string) => path.replace(new RegExp(`^${targetPath}`), ''),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                proxy.on('proxyReq', (proxyReq: any) => {
                    proxyReq.setHeader('origin', 'https://test.desk.solvimon.com');
                });
            },
        },
    };
}
