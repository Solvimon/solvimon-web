import { test, expect, type Page } from '@playwright/test';
import type { ApiMock, EndpointName } from '../support/api-mock';
import {
    customerOverview,
    hostEvents,
    mountCustomerOverview,
    type MountOptions,
} from '../support/customerOverview';
import { aCustomer, aCustomerPortalObject, anAccessTokenResponse } from '../support/fixtures';

/**
 * The auth session against the built SDK: how many times identity is asked for a token, and which
 * token each portal call carries. The customer overview loads five resources at once, which is the
 * burst a refresh has to be shared across.
 */

const DATA_ENDPOINTS: EndpointName[] = [
    'customer',
    'invoices',
    'subscriptions',
    'paymentMethods',
    'walletBalances',
];

/**
 * Requests to each endpoint in one load of the overview. Subscriptions are asked for twice: the
 * ones the customer is billed for, and every status to see whether any of them ships.
 */
const CALLS_PER_LOAD: Partial<Record<EndpointName, number>> = { subscriptions: 2 };

const tokenOf = (response: Record<string, unknown>) => String(response.access_token);
const bearer = (api: ApiMock, endpoint: EndpointName) =>
    api.lastCall(endpoint)?.headers['authorization'];

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCustomerOverview(page, options);
    await expect(customerOverview(page).billingInformation).toBeVisible();
    return api;
}

test.describe('Auth session', () => {
    let api: ApiMock;
    const pageErrors: string[] = [];

    test.beforeEach(({ page }) => {
        pageErrors.length = 0;
        page.on('pageerror', (error) => pageErrors.push(error.message));
    });

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
        expect(pageErrors).toEqual([]);
    });

    test('refreshes an expiring token once, before the burst of first requests', async ({
        page,
    }) => {
        const refreshed = anAccessTokenResponse();
        api = await mountLoaded(page, {
            mocks: {
                accessToken: { body: anAccessTokenResponse({ expiresInSeconds: 30 }) },
                refreshToken: { body: refreshed, delayMs: 300 },
            },
        });

        expect(api.calls('refreshToken')).toHaveLength(1);
        const refreshOrder = api.lastCall('refreshToken')!.order;
        DATA_ENDPOINTS.forEach((endpoint) => {
            expect(bearer(api, endpoint)).toBe(`Bearer ${tokenOf(refreshed)}`);
            expect(api.lastCall(endpoint)!.order).toBeGreaterThan(refreshOrder);
        });
    });

    test('retries a request the API rejects with a 401, after one refresh', async ({ page }) => {
        const first = anAccessTokenResponse();
        const refreshed = anAccessTokenResponse({ expiresInSeconds: 3000 });
        api = await mountCustomerOverview(page, {
            mocks: {
                accessToken: { body: first },
                refreshToken: { body: refreshed },
                customer: (request) =>
                    request.headers()['authorization'] === `Bearer ${tokenOf(first)}`
                        ? { status: 401, body: { message: 'Unauthorized' } }
                        : { body: aCustomer({ email: 'ada@example.com' }) },
            },
        });

        await expect(customerOverview(page).billingInformation).toContainText('ada@example.com');
        expect(api.calls('refreshToken')).toHaveLength(1);
        expect(api.calls('customer').map((call) => call.headers['authorization'])).toEqual([
            `Bearer ${tokenOf(first)}`,
            `Bearer ${tokenOf(refreshed)}`,
        ]);
        expect(api.lastCall('customer')?.headers['cookie']).toBeUndefined();
        const { logs } = await hostEvents(page);
        expect(logs.map(({ code }) => code)).not.toContain('REQUEST_FAILED');
    });

    test('does not hammer identity when the refresh fails', async ({ page }) => {
        api = await mountLoaded(page, {
            mocks: {
                accessToken: { body: anAccessTokenResponse({ expiresInSeconds: 30 }) },
                refreshToken: { status: 500, body: { message: 'Down' } },
            },
        });

        expect(api.calls('refreshToken')).toHaveLength(1);
        DATA_ENDPOINTS.forEach((endpoint) =>
            expect(api.calls(endpoint)).toHaveLength(CALLS_PER_LOAD[endpoint] ?? 1),
        );
    });

    test('refreshes once when the tab comes back after the laptop slept', async ({ page }) => {
        await page.clock.install();
        const refreshed = anAccessTokenResponse();
        api = await mountLoaded(page, {
            mocks: {
                accessToken: { body: anAccessTokenResponse({ expiresInSeconds: 120 }) },
                refreshToken: { body: refreshed },
            },
        });
        expect(api.calls('refreshToken')).toHaveLength(0);

        // Sleep moves the wall clock without firing any timer.
        await page.clock.setSystemTime(Date.now() + 10 * 60_000);
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await api.waitForCall('refreshToken');
        await page.waitForTimeout(300);
        expect(api.calls('refreshToken')).toHaveLength(1);
    });

    test('reports a malformed portal token without crashing', async ({ page }) => {
        api = await mountCustomerOverview(page, {
            portalObject: { ...aCustomerPortalObject(), token: 'not a portal token!' },
        });

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('INVALID_TOKEN');
        await expect(customerOverview(page).screen).toHaveCount(0);
        expect(api.calls('accessToken')).toEqual([]);
        expect(api.calls('customer')).toEqual([]);
        const { logs } = await hostEvents(page);
        expect(JSON.stringify(logs)).not.toContain('not a portal token!');
    });
});
