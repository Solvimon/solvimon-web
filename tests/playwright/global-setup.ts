import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { request, type FullConfig } from '@playwright/test';
import { TEST_APP_IDENTITY_PATH } from '../../global.config';

const REPO_ROOT = realpathSync(resolve(__dirname, '../..'));

/**
 * `reuseExistingServer` adopts whatever answers on the port, which is the test app of another
 * checkout as readily as this one's. Its answer here says which checkout it serves, and anything
 * but this one fails the run before a single test reports on the wrong build.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
    const baseURL = config.projects[0]?.use.baseURL;
    if (!baseURL) throw new Error('playwright.config.ts names no baseURL');

    const context = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
    try {
        const response = await context.get(TEST_APP_IDENTITY_PATH);
        const identity: unknown = response.ok()
            ? await response.json().catch(() => undefined)
            : undefined;
        const repoRoot =
            typeof identity === 'object' && identity !== null
                ? Reflect.get(identity, 'repoRoot')
                : undefined;

        if (repoRoot !== REPO_ROOT) {
            throw new Error(
                `The server on ${baseURL} is not this checkout's test app (it serves ` +
                    `${typeof repoRoot === 'string' ? repoRoot : 'something else'}, expected ` +
                    `${REPO_ROOT}). Stop it, or set PLAYWRIGHT_PORT to a free port.`,
            );
        }
    } finally {
        await context.dispose();
    }
}
