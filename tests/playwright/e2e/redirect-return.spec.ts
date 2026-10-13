import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { checkout, mountCheckout } from '../support/checkout';
import { aPortalObject, aSuccessfulAuthorization, PAYMENT_ACCEPTOR_ID } from '../support/fixtures';
import {
    mountPaymentMethodsManagement,
    paymentMethodsManagement,
} from '../support/paymentMethodsManagement';

/**
 * Adyen's drop-in cannot be driven here (its card fields come from Adyen's hosts), but a redirect
 * return is confirmed before the drop-in is built, through `/payments/verify-details`, which the
 * suite does answer.
 */

const CONFIGURATION = { email: 'customer@example.com', countryCode: 'NL' };
const SECOND_ADYEN_ACCEPTOR = 'paya_test_1';

/** Adyen's own hosts, which the drop-in reaches for and the harness aborts. */
const isAdyenHost = (url: string) => /adyen\.com/.test(new URL(url).hostname);

function pageErrors(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

/** Loads the screen once without a return, then arrives at `path` as the gateway sends one back. */
async function returnTo(page: Page, path: string, options: Parameters<typeof mountCheckout>[1]) {
    const api = await mountCheckout(page, {
        portalObject: aPortalObject({ successUrl: '' }),
        configuration: CONFIGURATION,
        ...options,
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    await page.goto(path);
    return api;
}

const verifications = (api: ApiMock) => api.calls('verifyPaymentDetails');

test.describe('Redirect returns', () => {
    let api: ApiMock;

    test.afterEach(() => {
        const escaped = (api?.unmatchedCalls() ?? []).filter((call) => !isAdyenHost(call.url));
        expect(escaped).toEqual([]);
    });

    test.describe('an Adyen redirect return', () => {
        test('is confirmed once with the value as sent, and a reload sends nothing', async ({
            page,
        }) => {
            const errors = pageErrors(page);
            api = await returnTo(
                page,
                `/?utm_source=mail&payment_acceptor_id=${PAYMENT_ACCEPTOR_ID}&redirectResult=X6XtfGC3%21H4sI%2B%2F%3D#frag`,
                {
                    gateways: ['ADYEN'],
                    mocks: { verifyPaymentDetails: { body: { payment_status: 'SUCCESS' } } },
                },
            );

            await expect(checkout(page).paid).toBeVisible();
            expect(verifications(api)).toHaveLength(1);
            expect(verifications(api)[0]?.body).toMatchObject({
                payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
                adyen: { details: { redirectResult: 'X6XtfGC3!H4sI+/=' } },
            });

            const url = new URL(page.url());
            expect([...url.searchParams.keys()]).toEqual(['utm_source']);
            expect(url.hash).toBe('#frag');

            await page.reload();
            await expect(checkout(page).paymentForm).toBeVisible();
            await page.waitForTimeout(500);
            expect(verifications(api)).toHaveLength(1);
            expect(errors).toEqual([]);
        });

        test('is asked about again exactly once when "Try again" follows a failed check', async ({
            page,
        }) => {
            api = await returnTo(
                page,
                `/?payment_acceptor_id=${PAYMENT_ACCEPTOR_ID}&redirectResult=res_1`,
                {
                    gateways: ['ADYEN'],
                    mocks: {
                        verifyPaymentDetails: [
                            { status: 503, body: { message: 'Unavailable' } },
                            { body: { payment_status: 'SUCCESS' } },
                        ],
                    },
                },
            );

            await expect(checkout(page).screen).toContainText('Payment could not be confirmed');
            expect(verifications(api)).toHaveLength(1);

            await page.getByRole('button', { name: /try again/i }).click();

            await expect(checkout(page).paid).toBeVisible();
            expect(verifications(api)).toHaveLength(2);
            expect(verifications(api).map((call) => call.body)).toEqual([
                verifications(api)[0]?.body,
                verifications(api)[0]?.body,
            ]);
        });

        test('is confirmed by the named acceptor only, with two Adyen acceptors', async ({
            page,
        }) => {
            api = await returnTo(
                page,
                `/?payment_acceptor_id=${SECOND_ADYEN_ACCEPTOR}&redirectResult=res_1`,
                {
                    gateways: ['ADYEN', 'ADYEN'],
                    mocks: { verifyPaymentDetails: { body: { payment_status: 'SUCCESS' } } },
                },
            );

            await expect(checkout(page).paid).toBeVisible();
            await page.waitForTimeout(500);
            expect(verifications(api)).toHaveLength(1);
            expect(verifications(api)[0]?.body).toMatchObject({
                payment_acceptor_id: SECOND_ADYEN_ACCEPTOR,
            });
        });

        test('is left alone by a Stripe form beside it', async ({ page }) => {
            api = await returnTo(
                page,
                `/?payment_acceptor_id=${SECOND_ADYEN_ACCEPTOR}&redirectResult=res_1`,
                {
                    gateways: ['STRIPE', 'ADYEN'],
                    mocks: { verifyPaymentDetails: { body: { payment_status: 'SUCCESS' } } },
                },
            );

            await expect(checkout(page).paid).toBeVisible();
            expect(verifications(api)).toHaveLength(1);
            expect(
                await page.evaluate(() => Reflect.get(window, '__STRIPE_STUB_RETRIEVALS__') ?? 0),
            ).toBe(0);
        });

        for (const [name, query] of [
            ['a malformed percent sequence', 'redirectResult=%E0%A4%A'],
            ['unicode', `redirectResult=${encodeURIComponent('résultat✓')}`],
            ['a wrong acceptor', 'redirectResult=res_1&payment_acceptor_id=paya_nobody'],
            ['no acceptor at all', 'redirectResult=res_1'],
        ] as const) {
            test(`neither crashes nor reaches the API on ${name}`, async ({ page }) => {
                const errors = pageErrors(page);
                const acceptor = query.includes('payment_acceptor_id')
                    ? ''
                    : query.startsWith('redirectResult=res_1')
                      ? ''
                      : `payment_acceptor_id=${PAYMENT_ACCEPTOR_ID}&`;
                api = await returnTo(page, `/?${acceptor}${query}`, { gateways: ['ADYEN'] });

                await expect(checkout(page).paymentForm).toBeVisible();
                await page.waitForTimeout(500);
                expect(verifications(api)).toEqual([]);
                expect(errors).toEqual([]);
            });
        }

        // The dev server turns a request line this long away, so the address is set in the page.
        test('neither crashes nor reaches the API on a huge value', async ({ page }) => {
            const errors = pageErrors(page);
            await page.addInitScript((acceptor) => {
                if (window.top !== window || !location.search.includes('huge=1')) return;
                history.replaceState(
                    null,
                    '',
                    `/?payment_acceptor_id=${acceptor}&redirectResult=${'A'.repeat(100_000)}`,
                );
            }, PAYMENT_ACCEPTOR_ID);
            api = await returnTo(page, '/?huge=1', { gateways: ['ADYEN'] });

            await expect(checkout(page).screen).toContainText('Payment not confirmed yet');
            expect(new URL(page.url()).search).toBe('');
            expect(verifications(api)).toEqual([]);
            expect(errors).toEqual([]);
        });

        // A lone `%` is read back as `%`, so only the shape check keeps it from being posted.
        test('does not post a lone percent sign to the API', async ({ page }) => {
            api = await returnTo(
                page,
                `/?payment_acceptor_id=${PAYMENT_ACCEPTOR_ID}&redirectResult=%`,
                {
                    gateways: ['ADYEN'],
                    mocks: { verifyPaymentDetails: { status: 422, body: { message: 'bad' } } },
                },
            );

            await expect(checkout(page).paymentForm).toBeVisible();
            await page.waitForTimeout(500);
            expect(verifications(api)).toEqual([]);
        });
    });

    test.describe('a Stripe redirect return', () => {
        const FAILED_RETURN = {
            redirect_status: 'failed',
            payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
            payment_intent: 'pi_3Tester',
            payment_intent_client_secret: 'pi_3Tester_secret_Abc123',
        };

        test('"Try again" brings back a form that is ready to pay, without a reload', async ({
            page,
        }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: CONFIGURATION,
                query: FAILED_RETURN,
                stripe: { intentStatus: 'requires_payment_method' },
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });
            let loads = 0;
            page.on('load', () => (loads += 1));

            await expect(checkout(page).screen).toContainText(/payment failed/i);
            await page.getByRole('button', { name: /try again/i }).click();

            await expect(checkout(page).stripeElement).toBeVisible();
            await expect(checkout(page).submit).toBeEnabled();
            await checkout(page).submit.click();
            await api.waitForCall('authorizePayment');

            await expect(checkout(page).paid).toBeVisible();
            expect(api.calls('authorizePayment')).toHaveLength(1);
            expect(loads).toBe(0);
        });

        test('is answered by Stripe once, and a reload asks again for nothing', async ({
            page,
        }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: CONFIGURATION,
                query: { ...FAILED_RETURN, utm_source: 'mail' },
                stripe: { intentStatus: 'requires_payment_method' },
            });

            await expect(checkout(page).screen).toContainText(/payment failed/i);
            expect([...new URL(page.url()).searchParams.keys()]).toEqual(['utm_source']);

            await page.reload();
            await expect(checkout(page).stripeElement).toBeVisible();
            await expect(checkout(page).screen).not.toContainText(/payment failed/i);
            expect(
                await page.evaluate(() => Reflect.get(window, '__STRIPE_STUB_RETRIEVALS__') ?? 0),
            ).toBe(0);
        });
    });

    test.describe('payment methods management', () => {
        test('confirms an Adyen method back from 3DS without being asked to add one', async ({
            page,
        }) => {
            api = await mountPaymentMethodsManagement(page, {
                gateways: ['ADYEN'],
                query: { payment_acceptor_id: PAYMENT_ACCEPTOR_ID, redirectResult: 'res_1' },
                mocks: { verifyPaymentDetails: { body: { payment_status: 'SUCCESS' } } },
            });
            const ui = paymentMethodsManagement(page);

            await api.waitForCall('verifyPaymentDetails');
            await expect(ui.form).toHaveCount(0);
            await expect(ui.addButton).toBeVisible();
            await page.waitForTimeout(500);
            expect(verifications(api)).toHaveLength(1);
            expect(new URL(page.url()).search).toBe('');
        });
    });
});
