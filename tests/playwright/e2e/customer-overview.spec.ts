import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    customerOverview,
    hostEvents,
    mountCustomerOverview,
    type MountOptions,
} from '../support/customerOverview';
import {
    aCustomer,
    aCustomerPortalObject,
    anInvoiceRecord,
    aPaymentMethod,
    aShippingAddress,
    aSubscription,
    aWalletBalance,
    collection,
    CUSTOMER_ID,
    walletBalances,
} from '../support/fixtures';

/**
 * The customer overview screen, end to end against a fully mocked API. See `checkout.spec.ts` for
 * what the harness does.
 *
 * This screen ends most of its flows by handing an action back to the host rather than doing
 * anything itself, so those tests assert on the `action-request` events the test app records.
 */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCustomerOverview(page, options);
    await expect(customerOverview(page).billingInformation).toBeVisible();
    return api;
}

test.describe('Customer overview', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('loads everything it shows for the portal customer', async ({ page }) => {
            api = await mountLoaded(page);

            expect(new URL((await api.waitForCall('customer')).url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}`,
            );
            (
                await Promise.all([
                    api.waitForCall('invoices'),
                    api.waitForCall('subscriptions'),
                    api.waitForCall('paymentMethods'),
                ])
            ).forEach((call) => {
                expect(new URL(call.url).searchParams.get('customer_id')).toBe(CUSTOMER_ID);
            });
            expect(new URL((await api.waitForCall('walletBalances')).url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}/wallets/balance`,
            );
        });

        test('asks only for the subscriptions a customer is being billed for', async ({ page }) => {
            api = await mountLoaded(page);

            const query = new URL(api.lastCall('subscriptions')!.url).searchParams;
            expect(query.getAll('statuses[]')).toEqual(['ACTIVE']);
            expect(query.get('type')).toBe('BILLING');
            expect(query.getAll('expand[]')).toEqual(['ALL']);
        });

        test('asks for a first page of invoices rather than all of them', async ({ page }) => {
            api = await mountLoaded(page);

            const query = new URL(api.lastCall('invoices')!.url).searchParams;
            expect(query.get('page')).toBe('1');
            expect(query.get('limit')).toBe('5');
        });

        test('sends the access token on every call', async ({ page }) => {
            api = await mountLoaded(page);

            [
                api.lastCall('customer'),
                api.lastCall('invoices'),
                api.lastCall('subscriptions'),
                api.lastCall('paymentMethods'),
                api.lastCall('walletBalances'),
            ].forEach((call) => expect(call?.headers['authorization']).toMatch(/^Bearer .+/));
        });
    });

    // ─── What it shows ────────────────────────────────────────────────────────

    test.describe('what it shows', () => {
        test('renders the subscriptions the customer is billed for', async ({ page }) => {
            api = await mountLoaded(page, {
                subscriptions: [aSubscription({ name: 'Pro plan' })],
            });

            await expect(customerOverview(page).subscriptions).toContainText('Pro plan');
        });

        test('summarises the subscriptions rather than listing them all', async ({ page }) => {
            api = await mountLoaded(page, {
                subscriptions: [
                    aSubscription({ id: 'ppsu_1', name: 'First plan' }),
                    aSubscription({ id: 'ppsu_2', name: 'Second plan' }),
                    aSubscription({ id: 'ppsu_3', name: 'Third plan' }),
                ],
            });
            const ui = customerOverview(page);

            await expect(ui.subscriptions).toContainText('First plan');
            await expect(ui.subscriptions).toContainText('Second plan');
            await expect(ui.subscriptions).not.toContainText('Third plan');
            await expect(ui.subscriptions.getByRole('button', { name: /view all/i })).toBeVisible();
        });

        test('renders the invoices the customer has', async ({ page }) => {
            api = await mountLoaded(page, {
                invoices: [
                    anInvoiceRecord({ id: 'inv_1', number: 'INV-2026-001', total: '20.00' }),
                    anInvoiceRecord({ id: 'inv_2', number: 'INV-2026-002', total: '35.00' }),
                ],
            });
            const ui = customerOverview(page);

            await expect(ui.invoices).toContainText('INV-2026-001');
            await expect(ui.invoices).toContainText('INV-2026-002');
            await expect(ui.invoices).toContainText('€35.00');
        });

        test('offers Pay only on the invoices that can be paid', async ({ page }) => {
            api = await mountLoaded(page, {
                invoices: [
                    anInvoiceRecord({ id: 'inv_1', number: 'INV-1' }),
                    { ...anInvoiceRecord({ id: 'inv_2', number: 'INV-2' }), type: 'CREDIT' },
                    anInvoiceRecord({ id: 'inv_3', number: 'INV-3', status: 'VOID' }),
                    anInvoiceRecord({ id: 'inv_4', number: 'INV-4', status: 'DRAFT' }),
                    anInvoiceRecord({ id: 'inv_5', number: 'INV-5', openAmount: '0.00' }),
                ],
            });
            const ui = customerOverview(page);

            await expect(ui.invoices).toContainText('INV-5');
            await expect(ui.invoices.getByRole('button', { name: /^pay$/i })).toHaveCount(1);
            await expect(ui.invoices).toContainText('Credit note');
            await expect(ui.invoices).toContainText('Void');
        });

        test('names each invoice row after the invoice it opens', async ({ page }) => {
            api = await mountLoaded(page, {
                invoices: [anInvoiceRecord({ id: 'inv_1', number: 'INV-2026-001' })],
            });

            await customerOverview(page)
                .invoices.getByRole('button', { name: 'View invoice INV-2026-001' })
                .click();

            const { actions } = await hostEvents(page);
            expect(JSON.stringify(actions)).toContain('inv_1');
        });

        test('renders the billing information on file', async ({ page }) => {
            api = await mountLoaded(page, { customer: aCustomer({ email: 'ada@example.com' }) });
            const ui = customerOverview(page);

            await expect(ui.billingInformation).toContainText('Ada Lovelace');
            await expect(ui.billingInformation).toContainText('ada@example.com');
            await expect(ui.billingInformation).toContainText('Amsterdam');
        });

        test('renders the payment methods on file', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [aPaymentMethod({ lastFourDigits: '4242', isDefault: true })],
            });

            await expect(customerOverview(page).paymentMethods).toContainText('4242');
        });

        test('renders the wallets the customer holds', async ({ page }) => {
            api = await mountLoaded(page, {
                wallets: walletBalances([aWalletBalance({ name: 'Credits' })]),
            });

            await expect(customerOverview(page).walletBalances).toContainText('Credits');
        });
    });

    // ─── Handing back to the host ─────────────────────────────────────────────

    test.describe('handing back to the host', () => {
        test('asks the host to show an invoice rather than showing it itself', async ({ page }) => {
            api = await mountLoaded(page, {
                invoices: [anInvoiceRecord({ id: 'inv_1', number: 'INV-2026-001' })],
            });

            await customerOverview(page)
                .invoices.locator('.sv-invoices-list__cell--invoice')
                .last()
                .click();

            const { actions } = await hostEvents(page);
            expect(actions.map(({ action }) => action)).toContain('view-invoice');
            // Named, so the host knows which invoice to open.
            expect(JSON.stringify(actions)).toContain('inv_1');
        });

        test('asks the host to take payment for an open invoice', async ({ page }) => {
            api = await mountLoaded(page, {
                invoices: [anInvoiceRecord({ id: 'inv_1', number: 'INV-2026-001' })],
            });

            await customerOverview(page).invoices.getByRole('button', { name: /^pay$/i }).click();

            const { actions } = await hostEvents(page);
            expect(actions.map(({ action }) => action)).toContain('pay-invoice');
            // Named, so the host knows which invoice to open.
            expect(JSON.stringify(actions)).toContain('inv_1');
        });

        test('asks the host for the rest of the subscriptions', async ({ page }) => {
            api = await mountLoaded(page, {
                subscriptions: [
                    aSubscription({ id: 'ppsu_1' }),
                    aSubscription({ id: 'ppsu_2' }),
                    aSubscription({ id: 'ppsu_3' }),
                ],
            });

            await customerOverview(page)
                .subscriptions.getByRole('button', { name: /view all/i })
                .click();

            await expect
                .poll(async () => (await hostEvents(page)).actions.map(({ action }) => action))
                .toContain('view-all-subscriptions');
        });

        test('asks the host to edit the billing information', async ({ page }) => {
            api = await mountLoaded(page);

            await customerOverview(page)
                .billingInformation.getByRole('button', { name: /edit/i })
                .click();

            await expect
                .poll(async () => (await hostEvents(page)).actions.map(({ action }) => action))
                .toContain('edit-billing-information');
            // The screen changes nothing itself.
            expect(api.calls('updateCustomer')).toEqual([]);
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    test.describe('failure modes', () => {
        test('says so when the wallets cannot be loaded, and shows the rest', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { walletBalances: { status: 500, body: { message: 'Boom' } } },
            });

            await expect(page.getByText(/could not load wallet balances/i)).toBeVisible();
            await expect(customerOverview(page).invoices).toBeVisible();
            await expect(customerOverview(page).billingInformation).toBeVisible();
        });

        test('says so when the subscriptions cannot be loaded', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { subscriptions: { status: 500, body: { message: 'Boom' } } },
            });

            await expect(customerOverview(page).subscriptions).toContainText(
                /could not load your subscriptions/i,
            );
            await expect(customerOverview(page).subscriptions).not.toContainText(
                /no subscriptions/i,
            );
        });

        test('reports invoices that cannot be loaded', async ({ page }) => {
            api = await mountCustomerOverview(page, {
                mocks: { invoices: { status: 500, body: { message: 'Boom' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
        });

        test('says so when the next invoices cannot be loaded, and lets the customer retry', async ({
            page,
        }) => {
            const firstPage = [1, 2, 3, 4, 5].map((n) =>
                anInvoiceRecord({ id: `inv_${n}`, number: `INV-${n}` }),
            );
            api = await mountLoaded(page, {
                mocks: {
                    invoices: [
                        {
                            body: {
                                ...collection(firstPage),
                                links: {
                                    current: '/v1/portal/invoices?page=1',
                                    next: '/v1/portal/invoices?page=2',
                                },
                            },
                        },
                        { status: 500, body: { message: 'Boom' } },
                        { body: collection([anInvoiceRecord({ id: 'inv_6', number: 'INV-6' })]) },
                    ],
                },
            });
            const ui = customerOverview(page);
            const loadMore = ui.invoices.getByRole('button', { name: /load more/i });
            const error = ui.invoices.getByText(/could not load your invoices/i);

            await loadMore.click();
            await expect(error).toBeVisible();

            // The button ignores a second click that follows the first too closely.
            await expect(async () => {
                await loadMore.click();
                await expect(ui.invoices).toContainText('INV-6', { timeout: 1000 });
            }).toPass();
            await expect(error).toHaveCount(0);
        });

        test('renders nothing that needs the customer when it cannot be loaded', async ({
            page,
        }) => {
            api = await mountCustomerOverview(page, {
                mocks: { customer: { status: 404, body: { message: 'Not found' } } },
            });

            await expect(customerOverview(page).billingInformation).toHaveCount(0);
            await expect(customerOverview(page).subscriptions).toHaveCount(0);
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountCustomerOverview(page, {
                portalObject: aCustomerPortalObject({ type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }),
            });

            await expect(customerOverview(page).screen).toHaveCount(0);
            expect(api.calls('customer')).toEqual([]);
        });
    });

    // ─── Shipping information ─────────────────────────────────────────────────

    test.describe('shipping information', () => {
        const HOME = aShippingAddress({ id: 'shad_home', isDefault: true });
        const OFFICE = aShippingAddress({ id: 'shad_office', line1: 'Herengracht 10' });

        const openManage = async (page: Page) => {
            await customerOverview(page)
                .shippingInformation.getByRole('button', { name: /^manage$/i })
                .click();
            await expect(customerOverview(page).shippingAddressesModal).toBeVisible();
        };

        test("shows the customer's default shipping address", async ({ page }) => {
            api = await mountLoaded(page, { shippingAddresses: [OFFICE, HOME] });
            const block = customerOverview(page).shippingInformation;

            await expect(block).toContainText('Shipping information');
            await expect(block).toContainText('Damrak 1');
            await expect(block).not.toContainText('Herengracht 10');

            const list = new URL((await api.waitForCall('shippingAddresses')).url).searchParams;
            expect(list.get('customer_id')).toBe(CUSTOMER_ID);
            expect(list.getAll('statuses[]')).toEqual(['ACTIVE']);
        });

        test('says so when there is no default address', async ({ page }) => {
            api = await mountLoaded(page, { shippingAddresses: [] });

            await expect(customerOverview(page).shippingInformation).toContainText(
                'No default shipping address yet.',
            );
        });

        test('lists every address in the manage modal, the default first', async ({ page }) => {
            api = await mountLoaded(page, { shippingAddresses: [OFFICE, HOME] });

            await openManage(page);

            const items = page.locator('.sv-shipping-addresses-modal__item');
            await expect(items).toHaveCount(2);
            await expect(items.first()).toContainText('Damrak 1');
            await expect(items.first()).toContainText('Default');
        });

        test('adds an address and goes back to the list, which now has it', async ({ page }) => {
            api = await mountLoaded(page, {
                shippingAddresses: [HOME],
                mocks: {
                    shippingAddresses: [
                        { body: collection([HOME]) },
                        {
                            body: collection([
                                HOME,
                                aShippingAddress({ id: 'shad_new', line1: 'Keizersgracht 5' }),
                            ]),
                        },
                    ],
                    createShippingAddress: {
                        status: 201,
                        body: aShippingAddress({ id: 'shad_new', line1: 'Keizersgracht 5' }),
                    },
                },
            });
            await openManage(page);

            await page.getByRole('button', { name: /add shipping address/i }).click();
            await page.locator('input[name="shipping_address_line_1"]').fill('Keizersgracht 5');
            await page.locator('input[name="shipping_postal_code"]').fill('1015 CJ');
            await page.locator('input[name="shipping_city"]').fill('Amsterdam');
            await page.locator('input[name="shipping_phone_number"]').fill('+31 6 12345678');
            await page.getByRole('button', { name: /save address/i }).click();

            const created = await api.waitForCall('createShippingAddress');
            expect(created.body).toMatchObject({
                customer_id: CUSTOMER_ID,
                address: { line1: 'Keizersgracht 5', city: 'Amsterdam', country: 'NL' },
            });
            await expect(page.locator('.sv-shipping-addresses-modal__item')).toHaveCount(2);
            await expect(customerOverview(page).shippingAddressesModal).toContainText(
                'Keizersgracht 5',
            );
        });

        test('stores nothing while the form says something is missing', async ({ page }) => {
            api = await mountLoaded(page);
            await openManage(page);

            await page.getByRole('button', { name: /add shipping address/i }).click();
            await page.getByRole('button', { name: /save address/i }).click();

            await expect(page.locator('input[name="shipping_address_line_1"]')).toBeVisible();
            expect(api.calls('createShippingAddress')).toEqual([]);
        });

        test('sets another address as the default from its menu', async ({ page }) => {
            api = await mountLoaded(page, {
                shippingAddresses: [HOME, OFFICE],
                mocks: { setDefaultShippingAddress: { body: OFFICE } },
            });
            await openManage(page);

            await customerOverview(page).shippingAddressMenuFor(1).click();
            await page.getByText('Set as default').click();

            const call = await api.waitForCall('setDefaultShippingAddress');
            expect(new URL(call.url).pathname).toBe(
                '/v1/portal/shipping-addresses/shad_office/set-as-default',
            );
            await expect.poll(() => api.calls('shippingAddresses').length).toBeGreaterThan(1);
        });

        test('deletes an address once the customer confirms', async ({ page }) => {
            api = await mountLoaded(page, {
                shippingAddresses: [HOME, OFFICE],
                mocks: { deleteShippingAddress: { body: OFFICE } },
            });
            await openManage(page);

            await customerOverview(page).shippingAddressMenuFor(1).click();
            await page.getByText(/^delete$/i).click();
            expect(api.calls('deleteShippingAddress')).toEqual([]);
            await page
                .getByRole('button', { name: /^delete$/i })
                .last()
                .click();

            const call = await api.waitForCall('deleteShippingAddress');
            expect(new URL(call.url).pathname).toBe(
                '/v1/portal/shipping-addresses/shad_office/deprecate',
            );
        });
    });
});
