import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { checkout, hostEvents, mountCheckout, type MountOptions } from '../support/checkout';
import {
    aFailedAuthorization,
    anActionRequiredAuthorization,
    anInvoicePreview,
    aPortalObject,
    aSubscription,
    aSuccessfulAuthorization,
    PAYMENT_ACCEPTOR_ID,
    paymentMethodOptions,
    SUBSCRIPTION_ID,
    SUCCESS_URL,
    TOKEN_USER_NAME,
    YEARLY,
} from '../support/fixtures';

/**
 * The checkout screen, end to end, against a fully mocked API.
 *
 * There is no test environment to run against, so every request is answered by the harness in
 * `../support/api-mock.ts` and then asserted on: with a mocked backend, the payload the SDK sends
 * is as much the subject of a test as what the screen renders off the response. Nothing reaches a
 * real host — the `afterEach` below fails the test if a single request escapes the mocks.
 *
 * Worth knowing before reading the assertions: Stripe is the gateway these tests drive. It is loaded from a URL the SDK names, so the suite
 *   serves a stub in its place (`../support/stripe-stub.ts`) and everything between the form and
 *   `/payments/authorize` stays real. Adyen is bundled and talks to Adyen's own hosts over a
 *   private protocol, so there is no seam to stand in at; its behaviour is covered by
 *   `PaymentIntegrationFormAdyen.spec.ts`.
 */

/** Waits until the screen has finished its initial load, so later call counts mean something. */
async function loaded(page: Page) {
    await expect(checkout(page).paymentForm).toBeVisible();
    await expect(checkout(page).stripeElement).toBeVisible();
}

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        ...options,
    });
    await loaded(page);
    return api;
}

test.describe('Checkout', () => {
    let api: ApiMock;

    test.afterEach(() => {
        // Nothing reaches the network that the mocks did not deliberately answer.
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('exchanges the portal token for an access token before anything else', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            const exchange = api.calls('accessToken')[0];
            expect(exchange?.body).toEqual({ token_alias: TOKEN_USER_NAME });
            expect(exchange?.order).toBeLessThan(api.calls('subscription')[0]!.order);
        });

        test('sends the access token as a bearer token on every other call', async ({ page }) => {
            api = await mountLoaded(page);

            const accessToken = api.lastCall('accessToken')?.headers['authorization'];
            expect(accessToken).toBeUndefined();

            const portalToken = aPortalObject().token;
            const authorized = [
                ...api.calls('subscription'),
                ...api.calls('invoicePreview'),
                ...api.calls('paymentMethodOptions'),
            ];

            expect(authorized.length).toBeGreaterThan(0);
            authorized.forEach((call) => {
                expect(call.headers['authorization']).toMatch(/^Bearer .+/);
                expect(call.headers['authorization']).not.toContain(String(portalToken));
            });
        });

        test('identifies itself with the client version header', async ({ page }) => {
            api = await mountLoaded(page);

            expect(api.lastCall('subscription')?.headers['x-client-version']).toMatch(
                /^solvimon-web-v\d+\.\d+\.\d+/,
            );
        });

        test('sends no credentials with any request', async ({ page, context }) => {
            await context.addCookies([
                {
                    name: 'session',
                    value: 'must-not-be-sent',
                    domain: 'test.api.solvimon.com',
                    path: '/',
                    secure: true,
                },
            ]);

            // Every mocked response allows a wildcard origin, and the browser refuses a wildcard
            // for a request that carries credentials. So a screen that loads at all is a screen
            // whose requests were made with `credentials: 'omit'` — flip that and the calls below
            // are blocked by CORS before they are ever answered.
            api = await mountLoaded(page);

            expect(api.calls('subscription').length).toBeGreaterThan(0);
            expect(api.calls('invoicePreview').length).toBeGreaterThan(0);
        });

        test('loads the subscription the portal object names, expanded', async ({ page }) => {
            api = await mountLoaded(page);

            const url = new URL(api.lastCall('subscription')!.url);
            expect(url.pathname).toBe(`/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}`);
            expect(url.searchParams.getAll('expand[]')).toEqual(['ALL']);
        });

        test('previews the invoice for a subscription that does not exist yet', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            // The template id, not `pricing_plan_subscription_id`: nothing has been created yet, so
            // the preview is priced off the template and the details it would be invoiced to.
            expect(api.lastCall('invoicePreview')?.body).toMatchObject({
                template_pricing_plan_subscription_id: SUBSCRIPTION_ID,
                customer_details: { reference: 'preview' },
            });
        });

        test('requests payment method options for the previewed amount and country', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            expect(api.lastCall('paymentMethodOptions')?.body).toEqual({
                country: 'NL',
                pricing_plan_subscription_id: SUBSCRIPTION_ID,
                // The amount the preview returned, not the plan's list price.
                amount: { quantity: '20.00', currency: 'EUR' },
            });
        });

        test('renders title, order summary, form and payment methods once loaded', async ({
            page,
        }) => {
            api = await mountLoaded(page);
            const ui = checkout(page);

            await expect(ui.title).toBeVisible();
            await expect(ui.orderSummary).toContainText('Order summary');
            await expect(ui.orderSummary).toContainText('Pro plan');
            await expect(ui.form).toBeVisible();
            await expect(ui.submit).toBeVisible();
        });

        test('asks for each thing it needs exactly once', async ({ page }) => {
            api = await mountLoaded(page);
            // Nothing else is in flight by now, so a second copy of any of these would have landed.
            await page.waitForTimeout(500);

            expect(api.calls('accessToken')).toHaveLength(1);
            expect(api.calls('subscription')).toHaveLength(1);
            expect(api.calls('invoicePreview')).toHaveLength(1);
        });

        test('tells the host when the screen is ready', async ({ page }) => {
            api = await mountLoaded(page);

            expect((await hostEvents(page)).ready).toBeGreaterThan(0);
        });
    });

    // ─── Configuration ────────────────────────────────────────────────────────

    test.describe('configuration', () => {
        test('prefills the email and keeps it read-only', async ({ page }) => {
            api = await mountLoaded(page, {
                configuration: { email: 'prefilled@example.com', countryCode: 'NL' },
            });

            await expect(checkout(page).email).toHaveValue('prefilled@example.com');
            await expect(checkout(page).email).toBeDisabled();
        });

        test('prefills the country and skips the geolocation lookup', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(checkout(page).country).toHaveAttribute('placeholder', 'Netherlands');
            expect(api.calls('geoLocation')).toEqual([]);
        });

        test('falls back to the geolocated country when the host names none', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com' },
                mocks: { geoLocation: { body: { ip: '203.0.113.9', country: 'DE' } } },
            });
            await loaded(page);

            await expect(checkout(page).country).toHaveAttribute('placeholder', 'Germany');
            expect(api.calls('geoLocation').length).toBeGreaterThan(0);
            expect(api.lastCall('paymentMethodOptions')?.body).toMatchObject({ country: 'DE' });
        });

        test('ignores an invalid country code and reports it to the host', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'XX' },
                mocks: { geoLocation: { body: { ip: '203.0.113.9', country: 'BE' } } },
            });
            await loaded(page);

            // Dropped rather than passed on, and the country is looked up instead.
            await expect(checkout(page).country).toHaveAttribute('placeholder', 'Belgium');
            expect((await hostEvents(page)).logs.map(({ code }) => code)).toContain(
                'INVALID_COUNTRY_CODE',
            );
            expect(api.calls('geoLocation').length).toBeGreaterThan(0);
            expect(api.lastCall('paymentMethodOptions')?.body).toMatchObject({ country: 'BE' });
        });

        test('ignores an invalid email and reports it to the host', async ({ page }) => {
            api = await mountLoaded(page, {
                configuration: { email: 'not-an-email', countryCode: 'NL' },
            });

            await expect(checkout(page).email).toHaveValue('');
            await expect(checkout(page).email).toBeEnabled();
            expect((await hostEvents(page)).logs.map(({ code }) => code)).toContain(
                'INVALID_EMAIL',
            );
        });

        test('applies a coupon code passed in the query string', async ({ page }) => {
            api = await mountLoaded(page, { query: { coupon_code: 'SUMMER' } });

            await expect
                .poll(() => customizationsOf(api.lastCall('invoicePreview')?.body)[0])
                .toMatchObject({ promotion_codes: ['SUMMER'] });
        });

        test('preselects the add-ons the host configured', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    addons: [{ pricingId: 'pri_addon', name: 'Extra support' }],
                }),
                configuration: {
                    email: 'customer@example.com',
                    countryCode: 'NL',
                    enabledPricingIds: ['pri_addon'],
                },
            });

            expect(customizationsOf(api.lastCall('invoicePreview')?.body)[0]).toMatchObject({
                enabled_pricings: [{ pricing_id: 'pri_addon' }],
            });
        });
    });

    // ─── Loading ──────────────────────────────────────────────────────────────

    test.describe('loading', () => {
        test('shows no order summary or submit button until the preview lands', async ({
            page,
        }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: {
                    invoicePreview: {
                        delayMs: 2000,
                        body: anInvoicePreview({ total: '20.00' }),
                    },
                },
            });

            await expect(checkout(page).screen).toBeVisible();
            await expect(checkout(page).submit).toHaveCount(0);
            await expect(checkout(page).title).toHaveCount(0);

            await expect(checkout(page).submit).toBeVisible({ timeout: 15000 });
        });
    });

    // ─── Order summary ────────────────────────────────────────────────────────

    test.describe('order summary', () => {
        test('renders the amounts the preview returned', async ({ page }) => {
            api = await mountLoaded(page, { periodTotals: { 'MONTH:1': '42.50' } });

            await expect(checkout(page).orderSummary).toContainText('€42.50');
            await expect(checkout(page).title).toContainText('€42.50');
        });

        test('asks to pay and subscribe when the plan has no trial', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(checkout(page).submit).toHaveText(/Pay and subscribe/i);
        });

        test('asks to start the trial when the plan has one', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({ trial: true }),
                trial: true,
            });

            await expect(checkout(page).submit).toHaveText(/Start trial/i);
            // The trial invoice is what is charged today; the regular one is what follows it.
            await expect(checkout(page).orderSummary).toContainText('Total due today');
            await expect(checkout(page).orderSummary).toContainText('€0.00');
        });

        test('previews every billing period the plan offers', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    billingPeriods: [{ type: 'MONTH', value: 1 }, YEARLY],
                }),
            });

            const requestedPeriods = api
                .calls('invoicePreview')
                .map((call) => customizationsOf(call.body)[0]?.billing_period);

            expect(requestedPeriods).toContainEqual({ type: 'MONTH', value: 1 });
            expect(requestedPeriods).toContainEqual({ type: 'YEAR', value: 1 });
        });

        test('renders a usage-based plan as usage based', async ({ page }) => {
            api = await mountLoaded(page, { usageBased: true });

            await expect(checkout(page).orderSummary).toContainText(/usage/i);
        });
    });

    // ─── Plan customization ───────────────────────────────────────────────────

    test.describe('plan customization', () => {
        test('is not shown for a plan with nothing to customize', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(checkout(page).planCustomization).toHaveCount(0);
        });

        test('previews again when the seat count changes', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    seats: [
                        { pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' },
                    ],
                }),
            });

            const before = api.calls('invoicePreview').length;
            await checkout(page).seats.fill('5');

            await expect
                .poll(() => customizationsOf(api.lastCall('invoicePreview')?.body)[0]?.seats_values)
                .toEqual([{ pricing_item_config_id: 'pico_seats', number: '5' }]);

            // One request for the change, not one per keystroke — the editor is debounced.
            expect(api.calls('invoicePreview').length - before).toBe(1);
        });

        test('previews again when an add-on is enabled', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    addons: [{ pricingId: 'pri_addon', name: 'Extra support' }],
                }),
            });

            await checkout(page)
                .planCustomization.getByRole('button', { name: /add to subscription/i })
                .first()
                .click();

            await expect
                .poll(
                    () =>
                        customizationsOf(api.lastCall('invoicePreview')?.body)[0]?.enabled_pricings,
                )
                .toEqual([{ pricing_id: 'pri_addon' }]);
        });
    });

    // ─── Billing details ──────────────────────────────────────────────────────

    test.describe('billing details', () => {
        test('re-prices and re-offers payment methods when the country changes', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');

            await expect
                .poll(() => api.lastCall('invoicePreview')?.body)
                .toMatchObject({
                    customer_details: { individual: { residential_address: { country: 'US' } } },
                });
            await expect
                .poll(() => api.lastCall('paymentMethodOptions')?.body)
                .toMatchObject({ country: 'US' });
        });

        test('requires the billing address for a country that needs one', async ({ page }) => {
            api = await mountLoaded(page);

            await selectCountry(page, 'United States');
            await expect(checkout(page).addressLine1).toBeVisible();

            await checkout(page).submit.click();

            await expect(checkout(page).form).toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('prices an organization as an organization', async ({ page }) => {
            api = await mountLoaded(page);

            await checkout(page).companyPurchase.click();

            // The legal name is not what the price depends on, so the switch alone re-prices —
            // as an organization, at the address the form holds.
            await expect
                .poll(() => api.lastCall('invoicePreview')?.body)
                .toMatchObject({
                    customer_details: {
                        type: 'ORGANIZATION',
                        organization: { registered_address: { country: 'NL' } },
                    },
                });
        });

        test('prices a valid VAT number as the tax id it is', async ({ page }) => {
            api = await mountLoaded(page);

            await checkout(page).companyPurchase.click();
            await checkout(page).legalName.fill('Example B.V.');
            await checkout(page).vatNumber.fill('NL000099998B57');

            // A VAT number is what decides whether the tax is charged or reverse-charged, so it is
            // one of the few fields that re-prices on its own.
            await expect
                .poll(() => api.lastCall('invoicePreview')?.body)
                .toMatchObject({
                    customer_details: {
                        organization: {
                            legal_name: 'Example B.V.',
                            tax_id: 'NL000099998B57',
                        },
                    },
                });
        });

        test('never sends an invalid VAT number', async ({ page }) => {
            api = await mountLoaded(page);

            await checkout(page).companyPurchase.click();
            await checkout(page).legalName.fill('Example B.V.');
            await checkout(page).vatNumber.fill('not-a-vat-number');
            await checkout(page).submit.click();

            await expect(checkout(page).form).toContainText(/Invalid tax ID format/i);
            api.calls('invoicePreview').forEach((call) => {
                expect(JSON.stringify(call.body)).not.toContain('not-a-vat-number');
            });
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('does not submit while the form is invalid', async ({ page }) => {
            api = await mountLoaded(page, { configuration: { countryCode: 'NL' } });

            await checkout(page).email.fill('');
            await checkout(page).submit.click();

            await expect(checkout(page).form).toContainText(/required/i);
            expect(api.calls('authorizePayment')).toEqual([]);
        });
    });

    // ─── Promotion code ───────────────────────────────────────────────────────

    test.describe('promotion code', () => {
        test('applies a code and shows it as applied', async ({ page }) => {
            api = await mountLoaded(page, { periodTotals: { 'MONTH:1': '20.00' } });

            api.on('invoicePreview', { body: anInvoicePreview({ total: '15.00' }) });
            await applyPromotionCode(page, 'SUMMER');

            expect(customizationsOf(api.lastCall('invoicePreview')?.body)[0]).toMatchObject({
                promotion_codes: ['SUMMER'],
            });
            await expect(checkout(page).promotionCode).toContainText('SUMMER');
            await expect(checkout(page).orderSummary).toContainText('€15.00');
        });

        test('reports a code the API rejects as invalid', async ({ page }) => {
            api = await mountLoaded(page);

            api.on('invoicePreview', {
                status: 400,
                body: { message: 'Unknown promotion code', field: 'promotion_codes' },
            });
            await applyPromotionCode(page, 'NOPE');

            await expect(checkout(page).promotionError).toBeVisible();
            await expect(checkout(page).orderSummary).toContainText('€20.00');
        });

        test('reports a failure to apply a code', async ({ page }) => {
            api = await mountLoaded(page);

            api.on('invoicePreview', { status: 500, body: { message: 'Server error' } });
            await applyPromotionCode(page, 'SUMMER');

            await expect(checkout(page).promotionError).toBeVisible();
        });

        test('removes an applied code and prices without it', async ({ page }) => {
            api = await mountLoaded(page);

            await applyPromotionCode(page, 'SUMMER');
            await expect(checkout(page).promotionCode).toContainText('SUMMER');

            await page.getByRole('button', { name: /remove promotion code/i }).click();

            await expect
                .poll(() => customizationsOf(api.lastCall('invoicePreview')?.body)[0])
                .not.toHaveProperty('promotion_codes');
        });
    });

    // ─── Payment methods ──────────────────────────────────────────────────────

    test.describe('payment methods', () => {
        test('asks for a billing country before offering any method', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com' },
                // No country configured and no geolocation to fall back on.
                mocks: { geoLocation: { status: 500, body: {} } },
            });

            await expect(checkout(page).paymentMethodsEmpty).toContainText(
                'Select your billing country',
            );
            expect(api.calls('paymentMethodOptions')).toEqual([]);
        });

        test('offers a way back when the options cannot be loaded', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: { paymentMethodOptions: { status: 500, body: { message: 'Boom' } } },
            });

            await expect(checkout(page).paymentMethodsError).toContainText(
                'Could not load payment methods',
            );
            await expect(checkout(page).paymentMethodsRetry).toBeVisible();
        });

        test('loads the options again from the error state', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: {
                    paymentMethodOptions: [
                        { status: 500, body: { message: 'Boom' } },
                        { body: paymentMethodOptions() },
                    ],
                },
            });

            await expect(checkout(page).paymentMethodsRetry).toBeVisible();
            const before = api.calls('paymentMethodOptions').length;

            await checkout(page).paymentMethodsRetry.click();

            await expect(checkout(page).paymentForm).toBeVisible();
            expect(api.calls('paymentMethodOptions').length).toBeGreaterThan(before);
        });

        test('says so when the API offers no methods at all', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: { paymentMethodOptions: { body: [] } },
            });

            await expect(checkout(page).paymentMethodsEmpty).toContainText(
                'No payment methods available',
            );
            await expect(checkout(page).submit).toBeDisabled();
        });

        test('mounts the gateway the options name', async ({ page }) => {
            api = await mountLoaded(page);

            // The stubbed Stripe element, inside the iframe the SDK mounts it in.
            await expect(checkout(page).stripeElement).toBeVisible();
        });
    });

    // ─── Payment authorization ────────────────────────────────────────────────

    test.describe('payment authorization', () => {
        test('authorizes with the subscription, the customer and the plan', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({
                    seats: [
                        { pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' },
                    ],
                    addons: [{ pricingId: 'pri_addon', name: 'Extra support' }],
                }),
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
                portalObject: aPortalObject({ successUrl: '' }),
            });

            await checkout(page)
                .planCustomization.getByRole('button', { name: /add to subscription/i })
                .first()
                .click();
            await applyPromotionCode(page, 'SUMMER');

            await checkout(page).submit.click();
            const authorization = await api.waitForCall('authorizePayment');

            expect(authorization.body).toMatchObject({
                payment_gateway_variant: 'STRIPE',
                amount: { quantity: '20.00', currency: 'EUR' },
                context: {
                    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
                    init_pricing_plan_subscription: {
                        template_pricing_plan_subscription_id: SUBSCRIPTION_ID,
                        customer_details: {
                            email: 'customer@example.com',
                            type: 'INDIVIDUAL',
                        },
                    },
                },
            });

            const [customization] = contextCustomizationsOf(authorization.body);
            expect(customization).toMatchObject({
                seats_values: [{ pricing_item_config_id: 'pico_seats', number: '2' }],
                enabled_pricings: [{ pricing_id: 'pri_addon' }],
                promotion_codes: ['SUMMER'],
            });
        });

        test('shows the payment as completed when there is nowhere to send the customer', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await checkout(page).submit.click();

            await expect(checkout(page).paid).toBeVisible();
            await expect(checkout(page).completedCard).toBeVisible();
            expect(api.navigations()).toEqual([]);
        });

        test('sends the customer back to the merchant on success', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await checkout(page).submit.click();

            await page.waitForURL(SUCCESS_URL);
            expect(api.navigations()).toContain(SUCCESS_URL);
        });

        test('completes a payment that needs a further step', async ({ page }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: { authorizePayment: { body: anActionRequiredAuthorization() } },
            });

            await checkout(page).submit.click();

            // The gateway handles the extra step; the SDK does not authorize a second time.
            await expect(checkout(page).paid).toBeVisible();
            expect(api.calls('authorizePayment')).toHaveLength(1);
        });

        test('reports a payment the gateway refuses and leaves the form usable', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: { authorizePayment: { body: aFailedAuthorization() } },
            });

            await checkout(page).submit.click();
            await api.waitForCall('authorizePayment');

            await expect(checkout(page).paid).toHaveCount(0);
            expect(api.navigations()).toEqual([]);
            await expect(checkout(page).screen).toContainText(/(fail|wrong|error|try again)/i);
        });

        test('reports an authorization that could not be sent', async ({ page }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: { authorizePayment: { status: 500, body: { message: 'Boom' } } },
            });

            await checkout(page).submit.click();
            await api.waitForCall('authorizePayment');

            await expect(checkout(page).paid).toHaveCount(0);
            const { logs } = await hostEvents(page);
            expect(logs.map(({ code }) => code)).toContain('PAYMENT_AUTHORIZATION_FAILED');
        });

        test('authorizes once however often the customer submits', async ({ page }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                mocks: {
                    authorizePayment: { delayMs: 2000, body: aSuccessfulAuthorization() },
                },
            });

            await checkout(page).submit.click();
            await checkout(page).submit.click({ force: true });
            await checkout(page).submit.click({ force: true });

            await expect(checkout(page).paid).toBeVisible({ timeout: 15000 });
            expect(api.calls('authorizePayment')).toHaveLength(1);
        });

        test('never authorizes when the gateway rejects the card details', async ({ page }) => {
            api = await mountLoaded(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                stripe: { submitError: { message: 'Your card number is incomplete.' } },
            });

            await checkout(page).submit.click();
            await page.waitForTimeout(1000);

            expect(api.calls('authorizePayment')).toEqual([]);
            await expect(checkout(page).paid).toHaveCount(0);
        });
    });

    // ─── Return from a redirect ───────────────────────────────────────────────

    test.describe('return from a redirect', () => {
        const REDIRECT_QUERY = {
            redirect_status: 'succeeded',
            payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
            payment_intent_client_secret: 'pi_test_secret',
        };

        const SAVED_FORM_STATE = JSON.stringify({
            email: 'returning@example.com',
            country: 'NL',
            type: 'INDIVIDUAL',
            firstName: 'Ada',
        });

        test('shows the payment as completed without authorizing again', async ({ page }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                query: REDIRECT_QUERY,
            });

            await expect(checkout(page).paid).toBeVisible();
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('restores the details the customer filled in before the redirect', async ({
            page,
        }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: { countryCode: 'NL' },
                sessionStorage: { solvimon_checkout_redirect_state: SAVED_FORM_STATE },
            });

            await expect(checkout(page).email).toHaveValue('returning@example.com');
        });

        test('clears the saved details once they have been restored', async ({ page }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ successUrl: '' }),
                configuration: { countryCode: 'NL' },
                sessionStorage: { solvimon_checkout_redirect_state: SAVED_FORM_STATE },
            });

            await expect(checkout(page).email).toHaveValue('returning@example.com');
            await expect
                .poll(() =>
                    page.evaluate(() => sessionStorage.getItem('solvimon_checkout_redirect_state')),
                )
                .toBeNull();
        });

        test('ignores saved details it cannot read', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                sessionStorage: { solvimon_checkout_redirect_state: 'not json' },
            });

            await loaded(page);
            await expect(checkout(page).email).toHaveValue('customer@example.com');
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    test.describe('failure modes', () => {
        test('reports a subscription that cannot be loaded', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
                .toContain('SUBSCRIPTION_LOAD_FAILED');
            await expect(checkout(page).submit).toHaveCount(0);
        });

        test('renders the unavailable screen for a revoked portal object', async ({ page }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ status: 'REVOKED' }),
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
            });

            await expect(checkout(page).unavailable).toBeVisible();
            const { logs } = await hostEvents(page);
            expect(logs.map(({ code }) => code)).toContain('RESOURCE_REVOKED');
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountCheckout(page, {
                portalObject: aPortalObject({ type: 'CUSTOMER' }),
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
                .toContain('INVALID_TOKEN');
            await expect(checkout(page).form).toHaveCount(0);
            expect(api.calls('subscription')).toEqual([]);
        });

        test('renders nothing and reports when the token exchange fails', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: { accessToken: { status: 401, body: { message: 'Unauthorized' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
                .toContain('INVALID_TOKEN');
            // Nothing is rendered without a token, so nothing is requested with one either.
            await expect(checkout(page).form).toHaveCount(0);
            expect(api.calls('subscription')).toEqual([]);
        });

        test('keeps the screen usable when the first preview fails', async ({ page }) => {
            api = await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
                mocks: {
                    invoicePreview: [
                        { status: 500, body: { message: 'Boom' } },
                        { body: anInvoicePreview({ total: '20.00' }) },
                    ],
                },
            });

            await expect(checkout(page).form).toBeVisible();

            // The form prices again on every change, so a failed first attempt is not fatal.
            await selectCountry(page, 'Belgium');
            await expect(checkout(page).submit).toBeVisible();
        });
    });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The schedule customizations out of an invoice preview payload. */
function customizationsOf(body: unknown): Record<string, unknown>[] {
    if (typeof body !== 'object' || body === null) return [];

    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    return Array.isArray(customizations) ? customizations : [];
}

/** The same, out of the context an authorization carries. */
function contextCustomizationsOf(body: unknown): Record<string, unknown>[] {
    if (typeof body !== 'object' || body === null) return [];

    const context = Reflect.get(body, 'context');
    if (typeof context !== 'object' || context === null) return [];

    const init = Reflect.get(context, 'init_pricing_plan_subscription');
    return customizationsOf(init);
}

/** Picks a country in the combobox the checkout renders for it. */
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
