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
    aSubscription,
    aWalletBalance,
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

            expect(new URL(api.lastCall('customer')!.url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}`,
            );
            [
                api.lastCall('invoices'),
                api.lastCall('subscriptions'),
                api.lastCall('paymentMethods'),
            ].forEach((call) => {
                expect(new URL(call!.url).searchParams.get('customer_id')).toBe(CUSTOMER_ID);
            });
            expect(new URL(api.lastCall('walletBalances')!.url).pathname).toBe(
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

        test('reports invoices that cannot be loaded', async ({ page }) => {
            api = await mountCustomerOverview(page, {
                mocks: { invoices: { status: 500, body: { message: 'Boom' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
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
});
