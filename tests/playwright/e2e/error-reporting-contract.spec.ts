import { test, expect } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { hostEvents, mountCheckout } from '../support/checkout';
import { mountCustomerOverview, customerOverview } from '../support/customerOverview';
import { mountSubscriptionManagement } from '../support/subscriptionManagement';
import { aCustomerPortalObject } from '../support/fixtures';

/**
 * The contract the README publishes: an unhandled failure is an `error` event and an
 * `UNHANDLED_ERROR` entry; a failure the element handles reaches `onLog` only; and an element given
 * its properties late renders once they arrive.
 */

test.describe('Error reporting contract', () => {
    let api: ApiMock | undefined;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
        api = undefined;
    });

    test('an unknown environment fires the error event exactly once', async ({ page }) => {
        api = await mountCustomerOverview(page, { environment: 'STAGING' });

        await expect.poll(async () => (await hostEvents(page)).errors).toHaveLength(1);
        await page.waitForTimeout(500);
        const { errors, logs } = await hostEvents(page);
        expect(errors).toHaveLength(1);
        expect(logs.filter(({ code }) => code === 'UNHANDLED_ERROR')).toHaveLength(1);
    });

    test('a subscription the checkout cannot load is reported once, not again as unhandled', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
        });

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('SUBSCRIPTION_LOAD_FAILED');
        await page.waitForTimeout(500);
        const { logs, errors } = await hostEvents(page);
        expect(logs.map(({ code }) => code)).not.toContain('UNHANDLED_ERROR');
        expect(errors).toEqual([]);
    });

    test('subscription management waits for a subscription id like the other screens', async ({
        page,
    }) => {
        api = await mountSubscriptionManagement(page, { configuration: {} });

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('MISSING_REQUIRED_PROPERTIES');
        expect(api.calls('subscription')).toEqual([]);
    });

    test('calls an onLog set right after the element was appended', async ({ page }) => {
        api = await mountCustomerOverview(page);
        await expect(customerOverview(page).billingInformation).toBeVisible();
        const portalObject = aCustomerPortalObject();

        await page.evaluate(
            ({ portalObject }) => {
                const codes: string[] = [];
                Object.assign(window, { __LATE_ON_LOG__: codes });
                const element = document.createElement('solvimon-customer-overview');
                document.body.append(element);
                Object.assign(element, {
                    environment: 'STAGING',
                    locale: 'en-US',
                    portalObject,
                    onLog: (entry: { code: string }) => codes.push(entry.code),
                });
            },
            { portalObject },
        );

        await expect
            .poll(() => page.evaluate((): unknown => Reflect.get(window, '__LATE_ON_LOG__')), {
                timeout: 3000,
            })
            .toContain('UNHANDLED_ERROR');
    });
});
