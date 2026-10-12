import { test, expect, type Page, type Request } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import type { StripeStubConfig } from '../support/stripe-stub';
import { checkout, mountCheckout } from '../support/checkout';
import {
    aFailedAuthorization,
    anActionRequiredAuthorization,
    anInvoicePreview,
    aSubscription,
    aSuccessfulAuthorization,
} from '../support/fixtures';

/**
 * DD-3540 pay race tester, round 2: the order is locked while a card payment is out, the lock is
 * let go on every way the payment can end, and a retry is priced from the form as it then is.
 */

const SEATS_SUBSCRIPTION = aSubscription({
    seats: [{ pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' }],
});

function seatsOf(request: Request): string {
    return /"pico_seats","number":"(\d+)"/.exec(JSON.stringify(request.postDataJSON()))?.[1] ?? '2';
}

const priceFor = (seats: string): string => `${Number(seats) * 10}.00`;

const seatsInBody = (body: unknown): string | undefined =>
    /"pico_seats","number":"(\d+)"/.exec(JSON.stringify(body))?.[1];

const amountOf = (body: unknown): unknown =>
    typeof body === 'object' && body !== null ? Reflect.get(body, 'amount') : undefined;

const byseats = (request: Request): MockResponse => ({
    body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
});

/** Stripe takes its time over the token, as the real one does over the network. */
async function slowStripeToken(page: Page, ms: number) {
    await page.addInitScript((delay: number) => {
        if (window.top === window) return;
        let wrapped: unknown;
        Object.defineProperty(window, 'Stripe', {
            configurable: true,
            get: () => wrapped,
            set: (factory: (...args: unknown[]) => Record<string, unknown>) => {
                wrapped = (...args: unknown[]) => {
                    const stripe = factory(...args);
                    const create = stripe.createConfirmationToken;
                    if (typeof create === 'function') {
                        stripe.createConfirmationToken = (...rest: unknown[]) =>
                            new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
                                Reflect.apply(create, stripe, rest),
                            );
                    }
                    return stripe;
                };
            },
        });
    }, ms);
}

async function mountSeats(
    page: Page,
    {
        authorizePayment = { body: aSuccessfulAuthorization() },
        stripe,
        invoicePreview = byseats,
    }: {
        authorizePayment?: MockResponse | MockResponse[];
        stripe?: Partial<StripeStubConfig>;
        invoicePreview?: (request: Request) => MockResponse;
    } = {},
): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        subscription: SEATS_SUBSCRIPTION,
        mocks: { invoicePreview, authorizePayment },
        ...(stripe ? { stripe } : {}),
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
    await expect(checkout(page).orderSummary).toContainText('20.00');
    return api;
}

const lockedParts = (page: Page) => [
    checkout(page).planCustomization,
    checkout(page).form,
    checkout(page).promotionCode,
];

async function expectLocked(page: Page, locked: boolean) {
    for (const part of lockedParts(page)) {
        if (locked) await expect(part).toHaveAttribute('inert', /.*/);
        else await expect(part).not.toHaveAttribute('inert', /.*/);
    }
}

/** A payment that fails, then pays with seats changed in between, at the price of the change. */
async function retryPaysLiveSeats(page: Page, api: ApiMock) {
    await expectLocked(page, false);
    await expect(checkout(page).seats).toBeEditable();
    await checkout(page).seats.fill('5');
    await expect(checkout(page).orderSummary).toContainText('50.00');
    // The failure card stands in for the card form until the customer asks for it back.
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(checkout(page).stripeElement).toBeVisible();
    await expect(checkout(page).submit).toBeEnabled();
    await page.waitForTimeout(600);
    await checkout(page).submit.click();

    const retry = await api.waitForCall('authorizePayment', 2);
    expect(seatsInBody(retry.body)).toBe('5');
    expect(amountOf(retry.body)).toEqual({ quantity: '50.00', currency: 'EUR' });
}

test.describe('DD-3540 pay race tester r2', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('locks the plan, the form and the promotion code while the card payment is out', async ({
        page,
    }) => {
        await slowStripeToken(page, 2000);
        api = await mountSeats(page);

        await checkout(page).submit.click();
        await expectLocked(page, true);

        // What a customer can do with a mouse and a keyboard reaches none of it.
        await page.locator('.sv-plan-customization__seats button').last().click({ force: true });
        await checkout(page).seats.focus();
        await page.keyboard.type('9');
        await expect(checkout(page).seats).toHaveValue('2');
        await expect(checkout(page).seats).not.toBeFocused();

        const authorization = await api.waitForCall('authorizePayment');
        expect(seatsInBody(authorization.body)).toBe('2');
        expect(amountOf(authorization.body)).toEqual({ quantity: '20.00', currency: 'EUR' });
    });

    test('lets the order go, and prices a retry from the form, after a refused payment', async ({
        page,
    }) => {
        api = await mountSeats(page, {
            authorizePayment: [
                { body: aFailedAuthorization() },
                { body: aSuccessfulAuthorization() },
            ],
        });

        await checkout(page).submit.click();
        await api.waitForCall('authorizePayment');
        await expect(checkout(page).screen).toContainText(/(fail|declined|try again)/i);

        await retryPaysLiveSeats(page, api);
    });

    test('lets the order go, but keeps Pay off, when the outcome of the payment is unknown', async ({
        page,
    }) => {
        api = await mountSeats(page, {
            authorizePayment: { status: 500, body: { message: 'boom' } },
        });

        await checkout(page).submit.click();
        await api.waitForCall('authorizePayment');

        // The payment may have gone through, so Pay stays off (DD-3537); the order is no longer held.
        await expectLocked(page, false);
        await expect(checkout(page).seats).toBeEditable();
        await expect(checkout(page).submit).toBeDisabled();
    });

    test('lets the order go after a failed 3DS step', async ({ page }) => {
        api = await mountSeats(page, {
            authorizePayment: [
                { body: anActionRequiredAuthorization() },
                { body: aSuccessfulAuthorization() },
            ],
            stripe: {
                nextActionError: {
                    message: 'We are unable to authenticate your payment method.',
                    code: 'payment_intent_authentication_failure',
                    type: 'card_error',
                },
            },
        });

        await checkout(page).submit.click();
        await expect(checkout(page).screen).toContainText(/(fail|wrong|error|try again)/i);

        await retryPaysLiveSeats(page, api);
    });

    test('lets the order go when Stripe will not make a token', async ({ page }) => {
        api = await mountSeats(page, {
            stripe: { confirmationTokenError: { message: 'Card declined', type: 'card_error' } },
        });

        await checkout(page).submit.click();
        await expect(checkout(page).screen).toContainText(/(fail|declined|try again)/i);

        await expectLocked(page, false);
        await expect(checkout(page).seats).toBeEditable();
        expect(api.calls('authorizePayment')).toEqual([]);
    });

    test('lets the order go when Stripe finds the card incomplete', async ({ page }) => {
        api = await mountSeats(page, {
            stripe: {
                submitError: {
                    message: 'Your card number is incomplete.',
                    type: 'validation_error',
                },
            },
        });

        await checkout(page).submit.click();
        await expect(checkout(page).submit).toBeEnabled();

        await expectLocked(page, false);
        await expect(checkout(page).seats).toBeEditable();
        expect(api.calls('authorizePayment')).toEqual([]);
    });

    test('holds a payment whose price never comes, then pays a later change at its price', async ({
        page,
    }) => {
        test.setTimeout(60_000);
        api = await mountSeats(page, {
            invoicePreview: (request) => ({
                delayMs: seatsOf(request) === '5' ? 120_000 : 0,
                body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
            }),
        });

        await checkout(page).seats.fill('5');
        // Past the disabled button, as Enter in an Adyen card field gets there.
        await checkout(page).submit.evaluate((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            button.disabled = false;
            button.click();
        });

        await expect(page.getByText('The price could not be brought up to date')).toBeVisible({
            timeout: 15_000,
        });
        expect(api.calls('authorizePayment')).toEqual([]);
        await expectLocked(page, false);

        await checkout(page).seats.fill('6');
        await expect(checkout(page).orderSummary).toContainText('60.00');
        await expect(checkout(page).submit).toBeEnabled();
        await page.waitForTimeout(600);
        await checkout(page).submit.click();

        const authorization = await api.waitForCall('authorizePayment');
        expect(seatsInBody(authorization.body)).toBe('6');
        expect(amountOf(authorization.body)).toEqual({ quantity: '60.00', currency: 'EUR' });
    });
});
