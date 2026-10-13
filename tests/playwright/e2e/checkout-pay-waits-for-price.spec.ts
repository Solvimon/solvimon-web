import { test, expect, type Page, type Request } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, mountCheckout, type MountOptions } from '../support/checkout';
import { anInvoicePreview, aSubscription, aSuccessfulAuthorization } from '../support/fixtures';

/**
 * A payment must carry the price of the form as it is when it is sent,
 * whichever way it is set off and whatever the preview does meanwhile.
 */

const SEATS_SUBSCRIPTION = aSubscription({
    seats: [{ pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' }],
});

function seatsOf(request: Request): string {
    const match = /"pico_seats","number":"(\d+)"/.exec(JSON.stringify(request.postDataJSON()));
    return match?.[1] ?? '2';
}

const priceFor = (seats: string): string => `${Number(seats) * 10}.00`;

const amountOf = (body: unknown): unknown =>
    typeof body === 'object' && body !== null ? Reflect.get(body, 'amount') : undefined;

const seatsInBody = (body: unknown): string | undefined =>
    /"pico_seats","number":"(\d+)"/.exec(JSON.stringify(body))?.[1];

async function mountSeats(
    page: Page,
    invoicePreview: (request: Request) => MockResponse,
    options: MountOptions = {},
): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        subscription: SEATS_SUBSCRIPTION,
        mocks: {
            invoicePreview,
            authorizePayment: { body: aSuccessfulAuthorization() },
        },
        ...options,
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
    await expect(checkout(page).orderSummary).toContainText('20.00');
    return api;
}

/**
 * Sets the payment off past the disabled Pay button, the way Enter in an Adyen card field or an
 * express sheet reaches the same submit without the button.
 */
async function payPastTheButton(page: Page) {
    await checkout(page).submit.evaluate((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.disabled = false;
        button.click();
    });
}

const paidAmount = async (api: ApiMock) => {
    const authorization = await api.waitForCall('authorizePayment');
    return {
        seats: seatsInBody(authorization.body),
        amount: amountOf(authorization.body),
    };
};

test.describe('Pay waiting for the price of the form', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('pays the new price when the payment is set off within the debounce', async ({ page }) => {
        api = await mountSeats(page, (request) => ({
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);

        expect(await paidAmount(api)).toEqual({
            seats: '5',
            amount: { quantity: '50.00', currency: 'EUR' },
        });
    });

    test('pays the new price when the preview of it is slow', async ({ page }) => {
        api = await mountSeats(page, (request) => ({
            delayMs: seatsOf(request) === '5' ? 1500 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);

        expect(await paidAmount(api)).toEqual({
            seats: '5',
            amount: { quantity: '50.00', currency: 'EUR' },
        });
    });

    test('holds the payment back when the form changes while it waits, then pays the latest', async ({
        page,
    }) => {
        api = await mountSeats(page, (request) => ({
            delayMs: seatsOf(request) === '5' ? 1500 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);
        await page.waitForTimeout(300);
        // Still typing when the preview of five lands: each keystroke keeps the change unasked.
        await checkout(page).seats.press('End');
        await checkout(page).seats.pressSequentially('1111111111', { delay: 100 });
        await checkout(page).seats.fill('7');

        // Nothing failed: the customer changed the order, so the message says that instead.
        await expect(page.getByText('The price changed with your last edit')).toBeVisible();
        expect(api.calls('authorizePayment')).toEqual([]);
        await expect(checkout(page).orderSummary).toContainText('70.00');

        // Not stuck: the next press pays the price of what is on the form.
        await expect(checkout(page).submit).toBeEnabled();
        await page.waitForTimeout(600);
        await checkout(page).submit.click();
        expect(await paidAmount(api)).toEqual({
            seats: '7',
            amount: { quantity: '70.00', currency: 'EUR' },
        });
    });

    test('follows a change the preview has been asked for while the payment waits', async ({
        page,
    }) => {
        api = await mountSeats(page, (request) => ({
            delayMs: seatsOf(request) === '5' ? 1500 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);
        await page.waitForTimeout(300);
        await checkout(page).seats.fill('7');

        // The payment goes on, at the price of the seats the form now holds.
        expect(await paidAmount(api)).toEqual({
            seats: '7',
            amount: { quantity: '70.00', currency: 'EUR' },
        });
    });

    test('asks a failed preview again on Pay, then pays its price', async ({ page }) => {
        let fiveSeatsAsked = 0;
        api = await mountSeats(page, (request) => {
            const seats = seatsOf(request);
            if (seats === '5' && ++fiveSeatsAsked === 1) {
                return { status: 500, body: { message: 'boom' } };
            }
            return { body: anInvoicePreview({ total: priceFor(seats) }) };
        });

        await checkout(page).seats.fill('5');
        await expect.poll(() => fiveSeatsAsked).toBe(1);
        // The failed preview leaves the old price on screen, and Pay is not held for it.
        await expect(checkout(page).submit).toBeEnabled();
        await page.waitForTimeout(600);
        await checkout(page).submit.click();

        expect(await paidAmount(api)).toEqual({
            seats: '5',
            amount: { quantity: '50.00', currency: 'EUR' },
        });
        expect(fiveSeatsAsked).toBe(2);
    });

    test('holds the payment back, and releases Pay, when the re-asked preview fails too', async ({
        page,
    }) => {
        api = await mountSeats(page, (request) =>
            seatsOf(request) === '5'
                ? { status: 500, body: { message: 'boom' } }
                : { body: anInvoicePreview({ total: priceFor(seatsOf(request)) }) },
        );

        await checkout(page).seats.fill('5');
        await expect(checkout(page).submit).toBeEnabled();
        await page.waitForTimeout(600);
        await checkout(page).submit.click();

        await expect(checkout(page).screen).toContainText(
            'The price could not be brought up to date',
        );
        expect(api.calls('authorizePayment')).toEqual([]);
        await expect(checkout(page).submit).toBeEnabled();
    });

    test('does not leave Pay stuck behind a preview that never answers', async ({ page }) => {
        let fiveSeatsAsked = 0;
        api = await mountSeats(page, (request) => {
            const seats = seatsOf(request);
            if (seats === '5' && ++fiveSeatsAsked === 1) {
                return { status: 500, body: { message: 'boom' } };
            }
            return {
                // The re-ask never comes back within the test.
                delayMs: seats === '5' ? 120_000 : 0,
                body: anInvoicePreview({ total: priceFor(seats) }),
            };
        });

        await checkout(page).seats.fill('5');
        await expect.poll(() => fiveSeatsAsked).toBe(1);
        await page.waitForTimeout(600);
        await checkout(page).submit.click();
        await expect.poll(() => fiveSeatsAsked).toBe(2);

        // The customer gives up on five seats; the preview for three answers at once. The waiting
        // payment follows it, as it follows any change asked for while it waits, and goes out at the
        // price of the seats the form now holds instead of staying stuck behind five.
        await checkout(page).seats.fill('3');

        expect(await paidAmount(api)).toEqual({
            seats: '3',
            amount: { quantity: '30.00', currency: 'EUR' },
        });
    });

    test('holds the payment back, and releases Pay, when the preview it waits on never answers', async ({
        page,
    }) => {
        test.setTimeout(45_000);
        api = await mountSeats(page, (request) => ({
            // The preview of five never comes back within the test.
            delayMs: seatsOf(request) === '5' ? 120_000 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);

        await expect(checkout(page).screen).toContainText(
            'The price could not be brought up to date',
            { timeout: 15_000 },
        );
        expect(api.calls('authorizePayment')).toEqual([]);
        await expect(checkout(page).seats).toBeEditable();
    });

    test('pays the discounted price when the code is applied just before', async ({ page }) => {
        api = await mountSeats(page, (request) => {
            const discounted = JSON.stringify(request.postDataJSON()).includes('SUMMER');
            return {
                delayMs: discounted ? 800 : 0,
                body: anInvoicePreview({ total: discounted ? '15.00' : '20.00' }),
            };
        });

        await page
            .getByRole('button', { name: /promotion code/i })
            .first()
            .click();
        await page.getByRole('textbox', { name: /promotion code/i }).fill('SUMMER');
        await page.getByRole('button', { name: /apply promotion code/i }).click();
        await payPastTheButton(page);

        const authorization = await api.waitForCall('authorizePayment');
        expect(amountOf(authorization.body)).toEqual({ quantity: '15.00', currency: 'EUR' });
        expect(JSON.stringify(authorization.body)).toContain('SUMMER');
    });

    test('pays the price of the seats typed so far when Pay comes mid-typing', async ({ page }) => {
        api = await mountSeats(page, (request) => ({
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.press('End');
        await checkout(page).seats.pressSequentially('1', { delay: 50 });
        await payPastTheButton(page);
        const typed = await checkout(page).seats.inputValue();

        const paid = await paidAmount(api);
        expect(paid.seats).toBe(typed);
        expect(paid.amount).toEqual({ quantity: priceFor(typed), currency: 'EUR' });
    });

    test('keeps one payment at a time while the price settles', async ({ page }) => {
        api = await mountSeats(page, (request) => ({
            delayMs: seatsOf(request) === '5' ? 1000 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).seats.fill('5');
        await payPastTheButton(page);
        await page.waitForTimeout(100);
        await payPastTheButton(page);
        await page.waitForTimeout(100);
        await payPastTheButton(page);

        await api.waitForCall('authorizePayment');
        await page.waitForTimeout(1500);
        expect(api.calls('authorizePayment')).toHaveLength(1);
        expect(amountOf(api.calls('authorizePayment')[0]?.body)).toEqual({
            quantity: '50.00',
            currency: 'EUR',
        });
    });

    test('pays a price that matches the seats sent when they change while Stripe makes its token', async ({
        page,
    }) => {
        // Stripe takes its time over the token, as the real one does over the network.
        await page.addInitScript(() => {
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
                                new Promise((resolve) => setTimeout(resolve, 1500)).then(() =>
                                    Reflect.apply(create, stripe, rest),
                                );
                        }
                        return stripe;
                    };
                },
            });
        });
        api = await mountSeats(page, (request) => ({
            delayMs: seatsOf(request) === '5' ? 3000 : 0,
            body: anInvoicePreview({ total: priceFor(seatsOf(request)) }),
        }));

        await checkout(page).submit.click();
        await page.waitForTimeout(200);
        await checkout(page).seats.fill('5');

        const paid = await paidAmount(api);
        expect(paid.amount).toEqual({ quantity: priceFor(paid.seats ?? '2'), currency: 'EUR' });
    });
});
