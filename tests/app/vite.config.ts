import { fileURLToPath, URL } from 'node:url';
import { resolve, dirname } from 'node:path';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { TEST_APP_HOST, TEST_APP_IDENTITY_PATH, TEST_APP_PORT } from '../../global.config';

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

const REPO_ROOT = fs.realpathSync(resolve(__dirname, '../..'));

/**
 * The SDK is a `file:` dependency, so it reaches this checkout's `dist` only if this checkout's
 * `node_modules` holds the link. A `node_modules` linked in from another checkout brings that
 * checkout's link with it, and the whole suite then runs against a build nobody is looking at.
 */
function sdkRoot(): string {
    const linked = resolve(__dirname, 'node_modules/@solvimon/solvimon-web');
    if (!fs.existsSync(linked)) {
        throw new Error(`The test app has no ${linked}. Run \`npm ci --prefix tests/app\`.`);
    }

    const root = fs.realpathSync(linked);
    if (root !== REPO_ROOT) {
        throw new Error(
            `The test app resolves @solvimon/solvimon-web to ${root}, not to ${REPO_ROOT}, so the ` +
                "e2e suite would run against another checkout's build. " +
                'See "Running e2e tests from a second checkout" in docs/development/testing.md.',
        );
    }

    return root;
}

function testAppIdentity(): Plugin {
    const identity = JSON.stringify({ repoRoot: REPO_ROOT, sdkRoot: sdkRoot() });

    return {
        name: 'solvimon-test-app-identity',
        configureServer(server) {
            server.middlewares.use(TEST_APP_IDENTITY_PATH, (_request, response) => {
                response.setHeader('content-type', 'application/json');
                response.end(identity);
            });
        },
    };
}

export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag.includes('solvimon-'),
                },
            },
        }),
        testAppIdentity(),
    ],
    server: {
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
