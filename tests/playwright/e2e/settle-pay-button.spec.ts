import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { checkout, mountCheckout, type MountOptions } from '../support/checkout';
import { mountPayInvoice, payInvoice, stripeElementsUpdates } from '../support/payInvoice';
import {
    mountPaymentMethodsManagement,
    paymentMethodsManagement,
} from '../support/paymentMethodsManagement';
import {
    anActionRequiredAuthorization,
    aPortalObject,
    aSuccessfulAuthorization,
    paymentMethodOptions,
} from '../support/fixtures';

const INCOMPLETE_CARD = {
    message: 'Your card number is incomplete.',
    type: 'validation_error',
    code: 'incomplete_number',
};

async function mountCheckoutLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        ...options,
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
    return api;
}

async function selectCountry(page: Page, country: string) {
    await checkout(page).country.click();
    await checkout(page).country.fill(country);
    await page.getByRole('option', { name: country, exact: true }).first().click();
}

test.describe('Pay button settles after every way a submit can end', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test.describe('Checkout', () => {
        test('pays after "Try again" brings the payment methods back', async ({ page }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: {
                    paymentMethodOptions: [
                        { status: 500, body: { message: 'Boom' } },
                        { body: paymentMethodOptions() },
                    ],
                    authorizePayment: { body: aSuccessfulAuthorization() },
                },
            });

            await expect(checkout(page).paymentMethodsRetry).toBeVisible();
            await expect(checkout(page).submit).toBeDisabled();

            await checkout(page).paymentMethodsRetry.click();
            await expect(checkout(page).stripeElement).toBeVisible();
            await expect(checkout(page).submit).toBeEnabled();

            await checkout(page).submit.click();
            await expect(checkout(page).paid).toBeVisible();
            expect(api.calls('authorizePayment')).toHaveLength(1);
        });

        test('keeps the button off while a reload of the options has failed', async ({ page }) => {
            api = await mountCheckoutLoaded(page, {
                mocks: {
                    paymentMethodOptions: (request) =>
                        request.postDataJSON()?.country === 'US'
                            ? { status: 500, body: { message: 'Boom' } }
                            : { body: paymentMethodOptions() },
                },
            });

            await selectCountry(page, 'United States');

            await expect(checkout(page).paymentMethodsError).toBeVisible();
            await expect(checkout(page).submit).toBeDisabled();
        });

        // A→B(fail)→A: the options for A are answered from the cache, which must not keep the
        // error of B, or the error card and the disabled button stay with nothing to retry.
        test('comes back when the customer returns to a country whose options loaded', async ({
            page,
        }) => {
            api = await mountCheckoutLoaded(page, {
                mocks: {
                    paymentMethodOptions: (request) =>
                        request.postDataJSON()?.country === 'US'
                            ? { status: 500, body: { message: 'Boom' } }
                            : { body: paymentMethodOptions() },
                },
            });

            await selectCountry(page, 'United States');
            await expect(checkout(page).paymentMethodsError).toBeVisible();

            await selectCountry(page, 'Netherlands');

            await expect(checkout(page).paymentMethodsError).toHaveCount(0, { timeout: 5000 });
            await expect(checkout(page).submit).toBeEnabled();
        });

        test('still completes a payment that needs a further step', async ({ page }) => {
            api = await mountCheckoutLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: { authorizePayment: { body: anActionRequiredAuthorization() } },
            });

            await checkout(page).submit.click();

            await expect(checkout(page).paid).toBeVisible();
            expect(api.calls('authorizePayment')).toHaveLength(1);
        });

        test('pays on a second try after empty card fields', async ({ page }) => {
            api = await mountCheckoutLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                stripe: { submitError: INCOMPLETE_CARD },
            });

            await checkout(page).submit.click();
            await expect(checkout(page).submit).toBeEnabled();
            await expect(checkout(page).paymentForm.locator('.pointer-events-none')).toHaveCount(0);
            expect(api.calls('authorizePayment')).toEqual([]);
        });
    });

    test.describe('Pay invoice', () => {
        async function mountLoaded(
            page: Page,
            options: Parameters<typeof mountPayInvoice>[1] = {},
        ): Promise<ApiMock> {
            const loaded = await mountPayInvoice(page, options);
            await expect(payInvoice(page).stripeElement).toBeVisible();
            return loaded;
        }

        test('hands the button back after empty card fields', async ({ page }) => {
            api = await mountLoaded(page, { stripe: { submitError: INCOMPLETE_CARD } });

            await payInvoice(page).payButton.click();

            await expect(payInvoice(page).payButton).toBeEnabled();
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('hands the button back when Stripe throws on submit', async ({ page }) => {
            api = await mountLoaded(page, { stripe: { submitRejection: 'boom' } });

            await payInvoice(page).payButton.click();

            await expect(payInvoice(page).payButton).toBeEnabled();
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        // Unticking the box changes the frame options, which the Stripe frame takes in place.
        test('pays after the Stripe frame options change', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await payInvoice(page).storePaymentMethod.click();
            await expect.poll(async () => (await stripeElementsUpdates(page)).length).toBe(1);

            await payInvoice(page).payButton.click();
            await expect.poll(() => api.calls('authorizePayment').length).toBe(1);
        });
    });

    test.describe('Payment method form', () => {
        test('hands the save button back after empty card fields', async ({ page }) => {
            api = await mountPaymentMethodsManagement(page, {
                stripe: { submitError: INCOMPLETE_CARD },
            });
            const ui = paymentMethodsManagement(page);
            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();

            await ui.submit.click();

            await expect(ui.submit).toBeEnabled();
            await expect(ui.form.locator('.pointer-events-none')).toHaveCount(0);
            expect(api.calls('tokenizePaymentMethod')).toEqual([]);
        });

        test('hands the save button back when Stripe throws on submit', async ({ page }) => {
            api = await mountPaymentMethodsManagement(page, {
                stripe: { submitRejection: 'boom' },
            });
            const ui = paymentMethodsManagement(page);
            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();

            await ui.submit.click();

            await expect(ui.form.locator('.pointer-events-none')).toHaveCount(0);
            expect(api.calls('tokenizePaymentMethod')).toEqual([]);
        });
    });
});
