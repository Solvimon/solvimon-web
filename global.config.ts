export const TEST_APP_HOST = 'localhost';

/**
 * Deliberately not Vite's default 5173: with `reuseExistingServer` on, another Vite app already
 * listening there is silently adopted as the test app and the whole suite runs against it.
 * `PLAYWRIGHT_PORT` moves it, so suites in two checkouts can run side by side.
 */
export const TEST_APP_PORT = parsePort(process.env.PLAYWRIGHT_PORT, 5273);

/** Served by the test app with the checkout it runs from; see `tests/playwright/global-setup.ts`. */
export const TEST_APP_IDENTITY_PATH = '/__solvimon-test-app';

function parsePort(value: string | undefined, fallback: number): number {
    if (value === undefined || value === '') return fallback;

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error(`PLAYWRIGHT_PORT must be a port between 1024 and 65535, got "${value}"`);
    }

    return port;
}
