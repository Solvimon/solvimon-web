import { test, expect, type Page } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, mountCheckout } from '../support/checkout';
import {
    aPortalObject,
    aSuccessfulAuthorization,
    PAYMENT_ACCEPTOR_ID,
    paymentMethodOptions,
    type Json,
} from '../support/fixtures';

/**
 * DD-3537 tester, round 2: Checkout must pay through the options of the country on screen, however
 * the lookups for the countries the customer passed through settle.
 */

const US_ACCEPTOR_ID = 'paya_test_us';

function usOptions(): Json[] {
    return paymentMethodOptions().map((option) => ({
        ...(option as Record<string, unknown>),
        payment_acceptor: { id: US_ACCEPTOR_ID },
    }));
}

async function selectCountry(page: Page, country: string) {
    await checkout(page).country.click();
    await checkout(page).country.fill(country);
    await page.getByRole('option', { name: country, exact: true }).first().click();
}

test.describe('DD-3537 payment method options, out of order', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('pays through the country on screen when a slow lookup for another lands late', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            portalObject: aPortalObject({ successUrl: '' }),
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: {
                paymentMethodOptions: (request): MockResponse =>
                    request.postDataJSON()?.country === 'US'
                        ? { delayMs: 3000, body: usOptions() }
                        : { body: paymentMethodOptions() },
                authorizePayment: { body: aSuccessfulAuthorization() },
            },
        });
        await expect(checkout(page).stripeElement).toBeVisible();

        await selectCountry(page, 'United States');
        await expect
            .poll(() =>
                api
                    .calls('paymentMethodOptions')
                    .some((c) => (c.body as { country?: string })?.country === 'US'),
            )
            .toBe(true);
        await selectCountry(page, 'Netherlands');
        // Let the slow lookup for the US land.
        await page.waitForTimeout(4000);

        await expect(checkout(page).stripeElement).toBeVisible();
        await checkout(page).submit.click();
        const authorization = await api.waitForCall('authorizePayment');

        expect(authorization.body).toMatchObject({ payment_acceptor_id: PAYMENT_ACCEPTOR_ID });
    });
    test('drops the failure of a country the customer already left for another', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: {
                paymentMethodOptions: (request): MockResponse => {
                    const country = (request.postDataJSON() as { country?: string })?.country;
                    if (country === 'US') {
                        return { delayMs: 1000, status: 500, body: { message: 'Boom' } };
                    }
                    if (country === 'DE') return { delayMs: 2500, body: paymentMethodOptions() };
                    return { body: paymentMethodOptions() };
                },
            },
        });
        await expect(checkout(page).stripeElement).toBeVisible();

        await selectCountry(page, 'United States');
        await selectCountry(page, 'Germany');
        await expect
            .poll(() =>
                api
                    .calls('paymentMethodOptions')
                    .some((c) => (c.body as { country?: string })?.country === 'DE'),
            )
            .toBe(true);
        // Both lookups have landed: the US failure first, the German options after it.
        await page.waitForTimeout(4000);

        await expect(checkout(page).paymentMethodsError).toHaveCount(0);
        await expect(checkout(page).submit).toBeEnabled();
    });
});
