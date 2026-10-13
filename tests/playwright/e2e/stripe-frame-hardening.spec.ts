import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    checkout,
    mountCheckout,
    stripeElementsOptions,
    stripeElementsUpdates,
    type MountOptions,
} from '../support/checkout';
import { mountPayInvoice, payInvoice } from '../support/payInvoice';
import {
    anActionRequiredAuthorization,
    anInvoicePreview,
    aPortalObject,
    aSubscription,
    aSuccessfulAuthorization,
    PAYMENT_ACCEPTOR_ID,
} from '../support/fixtures';

const CARD = '4242 4242 4242 4242';
const SECRET = 'pi_3Leaky_secret_DoNotLog';

const SEATS = aSubscription({
    seats: [{ pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' }],
});

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        portalObject: aPortalObject({ successUrl: '' }),
        ...options,
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
    return api;
}

/** The params each confirmation token was asked for, recorded by the stub. */
function confirmationTokenParams(page: Page): Promise<Record<string, unknown>[]> {
    return page.evaluate(() => {
        const recorded: unknown = Reflect.get(window, '__STRIPE_STUB_TOKENS__');
        return Array.isArray(recorded) ? recorded : [];
    });
}

async function selectCountry(page: Page, country: string) {
    await checkout(page).country.click();
    await checkout(page).country.fill(country);
    await page.getByRole('option', { name: country, exact: true }).first().click();
}

async function applyPromotionCode(page: Page, code: string) {
    await page
        .getByRole('button', { name: /promotion code/i })
        .first()
        .click();
    await page.getByRole('textbox', { name: /promotion code/i }).fill(code);
    await page.getByRole('button', { name: /apply promotion code/i }).click();
}

/** Everything the host and the console saw, for looking a secret up in. */
async function recordEverything(page: Page): Promise<() => Promise<string>> {
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));
    await page.addInitScript(() => {
        if (window.top !== window) return;
        const details: string[] = [];
        Reflect.set(window, '__DETAILS__', details);
        const keep = (event: Event) => {
            try {
                details.push(JSON.stringify((event as CustomEvent).detail));
            } catch {
                details.push(String((event as CustomEvent).detail));
            }
        };
        ['error', 'payment-failed', 'log'].forEach((type) =>
            window.addEventListener(type, keep, true),
        );
    });
    return async () =>
        JSON.stringify({
            console: consoleLines,
            details: await page.evaluate(() => Reflect.get(window, '__DETAILS__')),
            logs: await page.evaluate(() => Reflect.get(window, '__SOLVIMON_EVENTS__')),
        });
}

test.describe('Stripe frame hardening', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test.describe('one Payment Element', () => {
        test('keeps the card through a promotion code and pays the new amount', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });
            const ui = checkout(page);
            await ui.stripeCardNumber.fill(CARD);

            api.on('invoicePreview', { body: anInvoicePreview({ total: '15.00' }) });
            await applyPromotionCode(page, 'SUMMER');
            await expect(ui.promotionCode).toContainText('SUMMER');

            await expect
                .poll(async () => (await stripeElementsUpdates(page)).at(-1))
                .toMatchObject({ amount: 1500, currency: 'eur' });
            await expect(ui.stripeElement).toHaveCount(1);
            await expect(ui.stripeCardNumber).toHaveValue(CARD);
            expect(await stripeElementsOptions(page)).toHaveLength(1);

            await ui.submit.click();
            const authorization = await api.waitForCall('authorizePayment');
            expect(authorization.body).toMatchObject({
                amount: { quantity: '15.00', currency: 'EUR' },
            });
            await expect(ui.paid).toBeVisible();
        });

        test('keeps one element through seat counts typed in a row', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: SEATS,
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });
            const ui = checkout(page);
            await ui.stripeCardNumber.fill(CARD);

            api.on('invoicePreview', (request) => {
                const body = JSON.stringify(request.postDataJSON());
                const seats = /"number":"(\d+)"/.exec(body)?.[1] ?? '2';
                return { body: anInvoicePreview({ total: `${Number(seats) * 10}.00` }) };
            });
            for (const seats of ['3', '4', '5', '6', '7']) {
                await ui.seats.fill(seats);
                await page.waitForTimeout(40);
            }
            await ui.seats.fill('9');

            await expect
                .poll(async () => (await stripeElementsUpdates(page)).at(-1))
                .toMatchObject({ amount: 9000 });
            await expect(ui.stripeElement).toHaveCount(1);
            await expect(ui.stripeCardNumber).toHaveValue(CARD);
            expect(await stripeElementsOptions(page)).toHaveLength(1);

            await ui.submit.click();
            const authorization = await api.waitForCall('authorizePayment');
            expect(authorization.body).toMatchObject({ amount: { quantity: '90.00' } });
        });

        test('still takes the 3DS step after an update in place', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: SEATS,
                mocks: { authorizePayment: { body: anActionRequiredAuthorization() } },
            });
            const ui = checkout(page);
            api.on('invoicePreview', { body: anInvoicePreview({ total: '50.00' }) });
            await ui.seats.fill('5');
            await expect.poll(async () => (await stripeElementsUpdates(page)).length).toBe(1);

            await ui.submit.click();
            await expect(ui.paid).toBeVisible();
            expect(api.calls('authorizePayment')).toHaveLength(1);
        });

        test('bills the country chosen after the frame was set up', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });
            const ui = checkout(page);
            await ui.stripeCardNumber.fill(CARD);

            // Belgian VAT prices it differently, so the frame takes the new amount in place.
            api.on('invoicePreview', { body: anInvoicePreview({ total: '24.20' }) });
            await selectCountry(page, 'Belgium');
            await expect
                .poll(() => api.lastCall('paymentMethodOptions')?.body)
                .toMatchObject({ country: 'BE' });
            await expect
                .poll(async () => (await stripeElementsUpdates(page)).at(-1))
                .toMatchObject({ amount: 2420 });
            await expect(ui.stripeElement).toHaveCount(1);
            await expect(ui.stripeCardNumber).toHaveValue(CARD);

            await ui.submit.click();
            await api.waitForCall('authorizePayment');
            expect((await confirmationTokenParams(page)).at(-1)).toMatchObject({
                payment_method_data: { billing_details: { address: { country: 'BE' } } },
            });
        });

        // Known limitation, expected to fail until it is decided on: an email typed after the card
        // changes the fields the Payment Element hides, which it is set up anew for, so the card is
        // dropped.
        test.fail('keeps the card when the email is typed after it', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { countryCode: 'NL' },
                portalObject: aPortalObject({ successUrl: '' }),
            });
            const ui = checkout(page);
            await expect(ui.stripeElement).toBeVisible();
            await ui.stripeCardNumber.fill(CARD);

            await ui.email.fill('late@example.com');
            await expect.poll(async () => (await stripeElementsOptions(page)).length).toBe(2);

            await expect(ui.stripeElement).toHaveCount(1);
            await expect(ui.stripeCardNumber).toHaveValue(CARD, { timeout: 1000 });
        });

        test('keeps one element and pays through the save box ticked on and off', async ({
            page,
        }) => {
            api = await mountPayInvoice(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });
            const ui = payInvoice(page);
            await expect(ui.stripeElement).toBeVisible();
            await ui.stripeCardNumber.fill(CARD);

            await ui.storePaymentMethod.click();
            await ui.storePaymentMethod.click();
            await ui.storePaymentMethod.click();

            await expect.poll(async () => (await stripeElementsUpdates(page)).length).toBe(3);
            const updates = await stripeElementsUpdates(page);
            expect(updates.map((update) => update['setup_future_usage'])).toEqual([
                null,
                'off_session',
                null,
            ]);
            await expect(ui.stripeElement).toHaveCount(1);
            await expect(ui.stripeCardNumber).toHaveValue(CARD);

            await ui.payButton.click();
            await expect.poll(() => api.calls('authorizePayment').length).toBe(1);
        });
    });

    test.describe('messages from other windows', () => {
        // The frame sits in a shadow root, so it is not in window.frames; a window that has been
        // handed a reference to it some other way is still not its parent.
        test('ignores an init or update posted by a sibling frame', async ({ page }) => {
            api = await mountLoaded(page);
            const before = (await stripeElementsOptions(page)).length;

            const posted = await page.evaluate(() => {
                const findFrame = (root: Document | ShadowRoot): HTMLIFrameElement | null => {
                    const direct = root.querySelector('iframe');
                    if (direct) return direct;
                    for (const element of Array.from(root.querySelectorAll('*'))) {
                        if (element.shadowRoot) {
                            const found = findFrame(element.shadowRoot);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const stripeWindow = findFrame(document)?.contentWindow;
                if (!stripeWindow) return false;

                const sibling = document.createElement('iframe');
                document.body.appendChild(sibling);
                const siblingWindow = sibling.contentWindow as Window & { target?: Window };
                siblingWindow.target = stripeWindow;
                const script = siblingWindow.document.createElement('script');
                script.textContent = `
                    target.postMessage({ type: 'stripe:init', initId: 99, publicKey: 'pk_attacker',
                        options: { mode: 'payment', currency: 'usd', amount: 1 } }, '*');
                    target.postMessage({ type: 'stripe:update', options: { currency: 'usd', amount: 1 } }, '*');
                    target.postMessage({ type: 'stripe:submit' }, '*');
                `;
                siblingWindow.document.body.appendChild(script);
                sibling.remove();
                Reflect.set(window, '__STRIPE_WINDOW__', stripeWindow);
                return true;
            });

            expect(posted).toBe(true);
            await page.waitForTimeout(300);
            expect(await stripeElementsOptions(page)).toHaveLength(before);
            expect(await stripeElementsUpdates(page)).toEqual([]);
            expect(await confirmationTokenParams(page)).toEqual([]);
            await expect(checkout(page).stripeElement).toHaveCount(1);

            // The same update from the parent is taken, so the frame was reachable all along.
            await page.evaluate(() =>
                (Reflect.get(window, '__STRIPE_WINDOW__') as Window).postMessage(
                    { type: 'stripe:update', options: { currency: 'eur', amount: 2 } },
                    window.location.origin,
                ),
            );
            await expect.poll(async () => (await stripeElementsUpdates(page)).length).toBe(1);
        });
    });

    test.describe('no client secret leaves on a Stripe error', () => {
        test('a failed 3DS step', async ({ page }) => {
            const everything = await recordEverything(page);
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: anActionRequiredAuthorization() } },
                stripe: {
                    nextActionError: {
                        message: 'We are unable to authenticate your payment method.',
                        code: 'payment_intent_authentication_failure',
                        type: 'card_error',
                        // A StripeError carries the intent it is about.
                        payment_intent: { id: 'pi_3Leaky', client_secret: SECRET },
                    } as never,
                },
            });

            await checkout(page).submit.click();
            await expect(checkout(page).screen).toContainText(/(fail|wrong|error|try again)/i);

            const seen = await everything();
            expect(seen).toContain('payment_intent_authentication_failure');
            expect(seen).not.toContain(SECRET);
        });

        test('a redirect return Stripe could not look up', async ({ page }) => {
            const everything = await recordEverything(page);
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                query: {
                    redirect_status: 'succeeded',
                    payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
                    payment_intent_client_secret: SECRET,
                },
                stripe: {
                    retrieveError: {
                        message: 'No such payment_intent',
                        code: 'resource_missing',
                        type: 'invalid_request_error',
                        payment_intent: { id: 'pi_3Leaky', client_secret: SECRET },
                    } as never,
                },
            });

            await expect(checkout(page).screen).toContainText('Payment not confirmed yet');
            const seen = await everything();
            expect(seen).toContain('STRIPE_REDIRECT_RETURN_FAILED');
            expect(seen).not.toContain(SECRET);
        });
    });
});
