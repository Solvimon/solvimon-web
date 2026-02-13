import { defineConfig, devices } from '@playwright/test';
import { TEST_APP_HOST, TEST_APP_PORT } from './global.config';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests/playwright/e2e',
    outputDir: './tests/playwright/test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    timeout: 30000,
    expect: {
        timeout: 10000,
    },
    reporter: process.env.CI
        ? [
              ['dot'],
              ['html', { outputFolder: 'tests/playwright/report' }],
              ['junit', { outputFile: 'tests/playwright/results.xml' }],
          ]
        : 'list',
    use: {
        baseURL: `https://${TEST_APP_HOST}:${TEST_APP_PORT}`,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        serviceWorkers: 'block',
        // Ignore SSL errors for self-signed certificates in CI
        ignoreHTTPSErrors: true,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                headless: true,
            },
        },
    ],
    // Web server configuration - Playwright will start the test app automatically
    webServer: {
        command: 'npm run test:e2e:run-app',
        url: `https://${TEST_APP_HOST}:${TEST_APP_PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        ignoreHTTPSErrors: true,
    },
});
