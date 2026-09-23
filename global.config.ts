export const TEST_APP_HOST = 'localhost';
/**
 * Deliberately not Vite's default 5173: with `reuseExistingServer` on, another Vite app already
 * listening there is silently adopted as the test app and the whole suite runs against it.
 */
export const TEST_APP_PORT = 5273;
