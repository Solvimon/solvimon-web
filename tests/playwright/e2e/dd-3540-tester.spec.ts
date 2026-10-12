import { test, expect, type Page } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, hostEvents, mountCheckout } from '../support/checkout';
import {
    aFailedAuthorization,
    anInvoicePreview,
    aPortalObject,
    aSubscription,
    aSuccessfulAuthorization,
    PAYMENT_ACCEPTOR_ID,
    SUBSCRIPTION_ID,
} from '../support/fixtures';

/**
 * DD-3540 tester: the latest preview, the saved form and the promotion code, tried from outside.
 */

function customizationsOf(body: unknown): Record<string, unknown>[] {
    if (typeof body !== 'object' || body === null) return [];
    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    return Array.isArray(customizations) ? customizations : [];
}

function seatsOf(body: unknown): string | undefined {
    const seats = customizationsOf(body)[0]?.seats_values as { number?: string }[] | undefined;
    return seats?.[0]?.number;
}

function promotionCodesOf(body: unknown): unknown {
    return customizationsOf(body)[0]?.promotion_codes;
}

const SEATS_SUBSCRIPTION = aSubscription({
    seats: [{ pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' }],
});

const REDIRECT_QUERY = {
    redirect_status: 'failed',
    payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
    payment_intent_client_secret: 'pi_3TestIntent_secret_Abc123',
};

const savedFormKey = (subscriptionId: string) =>
    `solvimon_checkout_redirect_state:${subscriptionId}`;

const savedForm = (form: Record<string, unknown>, savedAt = Date.now()) =>
    JSON.stringify({ savedAt, form });

async function loaded(page: Page) {
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
}

test.describe('DD-3540 tester', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('charges the amount of the seats chosen last when an earlier preview lands late', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            portalObject: aPortalObject({ successUrl: '' }),
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            subscription: SEATS_SUBSCRIPTION,
            mocks: {
                invoicePreview: (request): MockResponse => {
                    const seats = seatsOf(request.postDataJSON()) ?? '2';
                    const total = `${Number(seats) * 10}.00`;
                    // Three seats answer long after five.
                    return {
                        delayMs: seats === '3' ? 2500 : 0,
                        body: anInvoicePreview({ total }),
                    };
                },
                authorizePayment: { body: aSuccessfulAuthorization() },
            },
        });
        await loaded(page);

        await checkout(page).seats.fill('3');
        await expect
            .poll(() => api.calls('invoicePreview').some((c) => seatsOf(c.body) === '3'))
            .toBe(true);
        await checkout(page).seats.fill('5');
        await expect
            .poll(() => api.calls('invoicePreview').some((c) => seatsOf(c.body) === '5'))
            .toBe(true);

        // Pay is held while the three-seat preview is still the latest one out... then five wins.
        await page.waitForTimeout(3000);
        await expect(checkout(page).orderSummary).toContainText('€50.00');
        await expect(checkout(page).submit).toBeEnabled();

        await checkout(page).submit.click();
        const authorization = await api.waitForCall('authorizePayment');
        expect(authorization.body).toMatchObject({ amount: { quantity: '50.00' } });
    });

    test('keeps Pay off while the preview is out', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            subscription: SEATS_SUBSCRIPTION,
            mocks: {
                invoicePreview: (request): MockResponse => ({
                    delayMs: seatsOf(request.postDataJSON()) === '4' ? 3000 : 0,
                    body: anInvoicePreview({ total: '20.00' }),
                }),
            },
        });
        await loaded(page);

        await checkout(page).seats.fill('4');
        await expect
            .poll(() => api.calls('invoicePreview').some((c) => seatsOf(c.body) === '4'))
            .toBe(true);
        await expect(checkout(page).submit).toBeDisabled();
        await expect(checkout(page).submit).toBeEnabled({ timeout: 6000 });
    });

    // The host's coupon is applied as the subscription lands, and the checkout's own first preview
    // starts right after with the code already in the form, taking the apply's preview over. The
    // apply then never learns the code was turned down.
    test.fail('reports a host coupon the API turns down', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'customer@example.com', countryCode: 'NL', couponCode: 'NOPE' },
            mocks: {
                invoicePreview: (request): MockResponse =>
                    promotionCodesOf(request.postDataJSON())
                        ? {
                              status: 400,
                              body: { message: 'Unknown promotion code', field: 'promotion_codes' },
                          }
                        : { body: anInvoicePreview({ total: '20.00' }) },
            },
        });

        await expect(checkout(page).promotionError).toBeVisible();
        await expect(checkout(page).promotionCode).not.toContainText('NOPE');
    });

    test('restores a promotion code on a redirect return, and lets it be removed', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            portalObject: aPortalObject({ successUrl: '' }),
            configuration: { countryCode: 'NL' },
            query: REDIRECT_QUERY,
            stripe: { intentStatus: 'requires_payment_method' },
            sessionStorage: {
                [savedFormKey(SUBSCRIPTION_ID)]: savedForm({
                    email: 'returning@example.com',
                    country: 'NL',
                    type: 'INDIVIDUAL',
                    promotionCode: 'SUMMER',
                }),
            },
        });

        await expect(checkout(page).email).toHaveValue('returning@example.com');
        await expect(checkout(page).promotionCode).toContainText('SUMMER');
        await expect
            .poll(() => promotionCodesOf(api.lastCall('invoicePreview')?.body))
            .toEqual(['SUMMER']);

        await page.getByRole('button', { name: /remove promotion code/i }).click();
        await expect
            .poll(() => promotionCodesOf(api.lastCall('invoicePreview')?.body))
            .toBeUndefined();
        await expect(checkout(page).promotionCode).not.toContainText('SUMMER');
    });

    test('does not prefill from another subscription saved in the same tab', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { countryCode: 'NL' },
            query: REDIRECT_QUERY,
            stripe: { intentStatus: 'requires_payment_method' },
            sessionStorage: {
                [savedFormKey('sub_someone_else')]: savedForm({ email: 'other@example.com' }),
                solvimon_checkout_redirect_state: JSON.stringify({ email: 'legacy@example.com' }),
            },
        });

        await expect(checkout(page).screen).toContainText(/payment failed/i);
        await expect(checkout(page).email).toHaveValue('');
        await expect
            .poll(() =>
                page.evaluate(() => sessionStorage.getItem('solvimon_checkout_redirect_state')),
            )
            .toBeNull();
    });

    test('keeps the email the host configured on a redirect return', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'host@example.com', countryCode: 'NL' },
            query: REDIRECT_QUERY,
            stripe: { intentStatus: 'requires_payment_method' },
            sessionStorage: {
                [savedFormKey(SUBSCRIPTION_ID)]: savedForm({
                    email: 'attacker@example.com',
                    firstName: 'Ada',
                }),
            },
        });

        await expect(checkout(page).screen).toContainText(/payment failed/i);
        await expect(checkout(page).email).toHaveValue('host@example.com');
    });

    test('drops a save older than an hour', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { countryCode: 'NL' },
            query: REDIRECT_QUERY,
            stripe: { intentStatus: 'requires_payment_method' },
            sessionStorage: {
                [savedFormKey(SUBSCRIPTION_ID)]: savedForm(
                    { email: 'returning@example.com' },
                    Date.now() - 61 * 60 * 1000,
                ),
            },
        });

        await expect(checkout(page).screen).toContainText(/payment failed/i);
        await expect(checkout(page).email).toHaveValue('');
        await expect
            .poll(() =>
                page.evaluate((key) => sessionStorage.getItem(key), savedFormKey(SUBSCRIPTION_ID)),
            )
            .toBeNull();
    });

    test('pays when storage throws', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error.stack)));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        // Only sessionStorage: `@solvimon/solvimon-ui` reads localStorage unguarded to format
        // amounts, so blocking that takes the whole screen down (outside this ticket).
        await page.addInitScript(() => {
            for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
                const original = Storage.prototype[method];
                Storage.prototype[method] = function (this: Storage, ...args: never[]) {
                    if (this === window.sessionStorage) throw new Error('blocked');
                    return (original as (...a: never[]) => unknown).apply(this, args);
                } as never;
            }
        });
        api = await mountCheckout(page, {
            portalObject: aPortalObject({ successUrl: '' }),
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
        });
        await loaded(page);

        await checkout(page).submit.click();

        await api.waitForCall('authorizePayment');
        await expect(checkout(page).paid).toBeVisible();
        expect(errors).toEqual([]);
        expect((await hostEvents(page)).logs.map(({ code }) => code)).toContain(
            'CHECKOUT_FORM_STATE_NOT_SAVED',
        );
    });

    test('keeps nothing in storage after an inline payment fails', async ({ page }) => {
        api = await mountCheckout(page, {
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: {
                authorizePayment: { body: aFailedAuthorization() },
            },
        });
        await loaded(page);
        await checkout(page).submit.click();
        await api.waitForCall('authorizePayment');
        await expect(checkout(page).submit).toBeEnabled();

        const keys = await page.evaluate(() => Object.keys(sessionStorage));
        expect(keys.filter((key) => key.startsWith('solvimon_checkout_redirect_state'))).toEqual(
            [],
        );
    });
});
