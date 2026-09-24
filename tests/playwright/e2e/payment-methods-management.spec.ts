import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountPaymentMethodsManagement,
    paymentMethodsManagement,
    type MountOptions,
} from '../support/paymentMethodsManagement';
import {
    aCustomerPortalObject,
    aPaymentMethod,
    collection,
    CUSTOMER_ID,
} from '../support/fixtures';

/**
 * The payment methods management screen, end to end against a fully mocked API. See
 * `checkout.spec.ts` for what the harness does and why Stripe is the gateway these tests drive.
 */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountPaymentMethodsManagement(page, options);
    await expect(paymentMethodsManagement(page).addButton).toBeVisible();
    return api;
}

test.describe('Payment methods management', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('loads the customer, their methods and what they can add', async ({ page }) => {
            api = await mountLoaded(page);

            expect(new URL(api.lastCall('customer')!.url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}`,
            );
            expect(
                new URL(api.lastCall('paymentMethods')!.url).searchParams.get('customer_id'),
            ).toBe(CUSTOMER_ID);
            expect(api.lastCall('paymentMethodOptions')?.body).toEqual({
                customer_id: CUSTOMER_ID,
            });
        });

        test('sends the access token on every call', async ({ page }) => {
            api = await mountLoaded(page);

            [
                api.lastCall('customer'),
                api.lastCall('paymentMethods'),
                api.lastCall('paymentMethodOptions'),
            ].forEach((call) => {
                expect(call?.headers['authorization']).toMatch(/^Bearer .+/);
            });
        });

        test('renders every method the customer has', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [
                    aPaymentMethod({ id: 'pmet_a', lastFourDigits: '4242', isDefault: true }),
                    aPaymentMethod({ id: 'pmet_b', lastFourDigits: '1881' }),
                ],
            });
            const ui = paymentMethodsManagement(page);

            await expect(ui.items).toHaveCount(2);
            await expect(ui.items.first()).toContainText('4242');
            await expect(ui.items.last()).toContainText('1881');
        });

        test('says which method is the default one', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [
                    aPaymentMethod({ id: 'pmet_a', lastFourDigits: '4242' }),
                    aPaymentMethod({ id: 'pmet_b', lastFourDigits: '1881', isDefault: true }),
                ],
            });
            const ui = paymentMethodsManagement(page);

            await expect(ui.items.last()).toContainText(/default/i);
            await expect(ui.items.first()).not.toContainText(/default/i);
        });

        test('never lists a method the customer already deleted', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [
                    aPaymentMethod({ id: 'pmet_a', lastFourDigits: '4242' }),
                    // Deleting archives rather than removes, so the API keeps answering with it.
                    aPaymentMethod({ id: 'pmet_b', lastFourDigits: '1881', status: 'ARCHIVED' }),
                ],
            });
            const ui = paymentMethodsManagement(page);

            await expect(ui.items).toHaveCount(1);
            await expect(ui.list).not.toContainText('1881');
        });

        test('renders no list for a customer with no methods', async ({ page }) => {
            api = await mountLoaded(page, { paymentMethods: [] });

            await expect(paymentMethodsManagement(page).list).toHaveCount(0);
            await expect(paymentMethodsManagement(page).addButton).toBeVisible();
        });
    });

    // ─── Adding a method ──────────────────────────────────────────────────────

    test.describe('adding a method', () => {
        test('offers the form on request and takes it away again', async ({ page }) => {
            api = await mountLoaded(page);
            const ui = paymentMethodsManagement(page);

            await expect(ui.form).toHaveCount(0);

            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();

            await ui.cancelButton.click();
            await expect(ui.form).toHaveCount(0);
        });

        test('stores the new method against the customer', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { tokenizePaymentMethod: { body: { status: 'SUCCESS' } } },
            });
            const ui = paymentMethodsManagement(page);

            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();
            await ui.submit.click();

            const tokenize = await api.waitForCall('tokenizePaymentMethod');
            expect(tokenize.body).toMatchObject({
                customer_id: CUSTOMER_ID,
                payment_gateway_variant: 'STRIPE',
                stripe: { confirmation_token_id: 'ctoken_test_default' },
            });
            // Storing a method charges nothing, so nothing is authorized.
            expect(api.calls('authorizePayment')).toEqual([]);
        });

        test('confirms the method was stored', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { tokenizePaymentMethod: { body: { status: 'SUCCESS' } } },
            });
            const ui = paymentMethodsManagement(page);

            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();
            await ui.submit.click();

            await expect(ui.form).toContainText(/added/i);
        });

        test('reports a method the gateway would not store', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    tokenizePaymentMethod: { status: 500, body: { message: 'Boom' } },
                },
            });
            const ui = paymentMethodsManagement(page);

            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();
            await ui.submit.click();
            await api.waitForCall('tokenizePaymentMethod');

            await expect(ui.form).not.toContainText(/added/i);
        });

        test('lists the new method without a reload', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [],
                mocks: { tokenizePaymentMethod: { body: { status: 'SUCCESS' } } },
            });
            const ui = paymentMethodsManagement(page);

            await ui.addButton.click();
            await expect(ui.stripeElement).toBeVisible();

            api.on('paymentMethods', {
                body: collection([aPaymentMethod({ lastFourDigits: '4242' })]),
            });
            await ui.submit.click();
            await api.waitForCall('tokenizePaymentMethod');

            await expect(ui.items).toHaveCount(1);
        });
    });

    // ─── Managing a method ────────────────────────────────────────────────────

    test.describe('managing a method', () => {
        const TWO_METHODS = [
            aPaymentMethod({ id: 'pmet_a', lastFourDigits: '4242', isDefault: true }),
            aPaymentMethod({ id: 'pmet_b', lastFourDigits: '1881' }),
        ];

        test('makes another method the default one', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: TWO_METHODS,
                mocks: { updatePaymentMethod: { body: aPaymentMethod({ id: 'pmet_b' }) } },
            });
            const ui = paymentMethodsManagement(page);

            await ui.menuFor(1).click();
            await page.getByText('Set as default').click();

            const update = await api.waitForCall('updatePaymentMethod');
            expect(new URL(update.url).pathname).toBe('/v1/portal/payment-methods/pmet_b');
            expect(update.body).toEqual({ is_default: true });

            // The list is asked for again, so what it shows is what the API now holds.
            await expect.poll(() => api.calls('paymentMethods').length).toBeGreaterThan(1);
        });

        test('asks before deleting a method', async ({ page }) => {
            api = await mountLoaded(page, { paymentMethods: TWO_METHODS });
            const ui = paymentMethodsManagement(page);

            await ui.menuFor(1).click();
            await page.getByText('Delete').click();

            await expect(ui.deleteModal).toContainText(/are you sure/i);
            // The method it is about, so the customer can see which one they picked.
            await expect(ui.deleteModal).toContainText('1881');
            expect(api.calls('updatePaymentMethod')).toEqual([]);
        });

        test('archives the method once the customer confirms', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: TWO_METHODS,
                mocks: {
                    updatePaymentMethod: { body: aPaymentMethod({ id: 'pmet_b' }) },
                },
            });
            const ui = paymentMethodsManagement(page);

            await ui.menuFor(1).click();
            await page.getByText('Delete').click();
            api.on('paymentMethods', { body: collection([TWO_METHODS[0]!]) });
            await ui.confirmDelete.click();

            const update = await api.waitForCall('updatePaymentMethod');
            expect(new URL(update.url).pathname).toBe('/v1/portal/payment-methods/pmet_b');
            // Deleting archives: the record has to survive for the invoices already paid with it.
            expect(update.body).toEqual({ status: 'ARCHIVED' });

            await expect(ui.items).toHaveCount(1);
        });

        test('keeps the method when it cannot be deleted', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: TWO_METHODS,
                mocks: { updatePaymentMethod: { status: 500, body: { message: 'Boom' } } },
            });
            const ui = paymentMethodsManagement(page);

            await ui.menuFor(1).click();
            await page.getByText('Delete').click();
            await ui.confirmDelete.click();

            await expect(ui.deleteModalError).toBeVisible();
            await expect(ui.items).toHaveCount(2);
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    test.describe('failure modes', () => {
        test('renders nothing and reports when the customer cannot be loaded', async ({ page }) => {
            api = await mountPaymentMethodsManagement(page, {
                mocks: { customer: { status: 404, body: { message: 'Not found' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
                .toContain('INITIAL_DATA_LOAD_FAILED');
            // The screen renders on the customer, so there is nothing to manage without one.
            await expect(paymentMethodsManagement(page).addButton).toHaveCount(0);
        });

        test('reports methods that cannot be loaded', async ({ page }) => {
            api = await mountPaymentMethodsManagement(page, {
                mocks: { paymentMethods: { status: 500, body: { message: 'Boom' } } },
            });

            // Asserted at error level rather than by code: this one reaches the host as
            // `UNHANDLED_ERROR` while a failing customer reaches it as `INITIAL_DATA_LOAD_FAILED`,
            // and which of the two a host sees is not something it can act on differently.
            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountPaymentMethodsManagement(page, {
                portalObject: aCustomerPortalObject({ type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }),
            });

            await expect(paymentMethodsManagement(page).addButton).toHaveCount(0);
            expect(api.calls('customer')).toEqual([]);
        });
    });
});
