import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountPayInvoice,
    payInvoice,
    stripeElementsOptions,
    type MountOptions,
} from '../support/payInvoice';
import {
    aCustomerPortalObject,
    aFailedAuthorization,
    anInvoiceRecord,
    aSuccessfulAuthorization,
    CUSTOMER_ID,
    INVOICE_ID,
    PAYMENT_ACCEPTOR_ID,
    paymentMethodOptions,
} from '../support/fixtures';

/**
 * The pay invoice screen, end to end against a fully mocked API. See `checkout.spec.ts` for what
 * the harness does and why Stripe is the gateway these tests drive.
 */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountPayInvoice(page, options);
    await expect(payInvoice(page).stripeElement).toBeVisible();
    return api;
}

test.describe('Pay invoice', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('loads the invoice the host named and what has been tried on it', async ({ page }) => {
            api = await mountLoaded(page);

            expect(new URL(api.lastCall('invoice')!.url).pathname).toBe(
                `/v1/portal/invoices/${INVOICE_ID}`,
            );
            expect(new URL(api.lastCall('payments')!.url).searchParams.get('invoice_id')).toBe(
                INVOICE_ID,
            );
        });

        test('asks what can pay the amount still open on it', async ({ page }) => {
            api = await mountLoaded(page, {
                invoice: anInvoiceRecord({ total: '75.00', openAmount: '25.00' }),
            });

            // What is left to pay, not what the invoice was for — and asked of the invoice, so
            // the answer only carries acceptors it can be paid through (DD-3533).
            expect(api.lastCall('paymentMethodOptions')?.body).toEqual({
                customer_id: CUSTOMER_ID,
                invoice_id: INVOICE_ID,
                amount: { quantity: '25.00', currency: 'EUR' },
            });
        });

        test('renders the invoice and what it comes to', async ({ page }) => {
            api = await mountLoaded(page, {
                invoice: anInvoiceRecord({ number: 'INV-2026-042', total: '20.00' }),
            });
            const ui = payInvoice(page);

            await expect(ui.screen).toContainText('INV-2026-042');
            await expect(ui.screen).toContainText('€20.00');
            await expect(ui.payButton).toContainText('€20.00');
        });

        test('sends the access token on every call', async ({ page }) => {
            api = await mountLoaded(page);

            [
                api.lastCall('invoice'),
                api.lastCall('payments'),
                api.lastCall('paymentMethods'),
            ].forEach((call) => expect(call?.headers['authorization']).toMatch(/^Bearer .+/));
        });
    });

    // ─── An invoice already paid ──────────────────────────────────────────────

    test.describe('an invoice already paid', () => {
        test('thanks the customer instead of asking again', async ({ page }) => {
            api = await mountPayInvoice(page, {
                invoice: anInvoiceRecord({ paid: true, openAmount: '0.00' }),
            });
            const ui = payInvoice(page);

            await expect(ui.paid).toBeVisible();
            await expect(ui.stripeElement).toHaveCount(0);
        });

        test('offers nothing to pay', async ({ page }) => {
            api = await mountPayInvoice(page, {
                invoice: anInvoiceRecord({ paid: true, openAmount: '0.00' }),
            });

            await expect(payInvoice(page).paid).toBeVisible();
            await expect(payInvoice(page).payButton).toHaveCount(0);
        });
    });

    // ─── Paying ───────────────────────────────────────────────────────────────

    test.describe('paying', () => {
        test('authorizes against the invoice it is paying', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await payInvoice(page).payButton.click();
            const authorization = await api.waitForCall('authorizePayment');

            expect(authorization.body).toMatchObject({
                payment_gateway_variant: 'STRIPE',
                customer_id: CUSTOMER_ID,
                amount: { quantity: '20.00', currency: 'EUR' },
                // Which invoice is being paid travels in the context, not as a field of its own.
                context: {
                    type: 'INVOICE',
                    related_resource_ids: [{ type: 'INVOICE', id: INVOICE_ID }],
                },
            });
        });

        test('offers to keep the method for next time', async ({ page }) => {
            api = await mountLoaded(page);

            // Offered ticked: paying the next invoice without re-entering the card is the common
            // case, and opting out is one click.
            await expect(payInvoice(page).storePaymentMethod).toBeVisible();
            await expect(page.getByRole('checkbox').first()).toBeChecked();
        });

        test('asks the gateway to keep the method while the box is ticked', async ({ page }) => {
            api = await mountLoaded(page);

            // `setup_future_usage` is what asks Stripe to keep the method for later.
            const [options] = await stripeElementsOptions(page);
            expect(options).toMatchObject({ mode: 'payment', setup_future_usage: 'off_session' });
        });

        test('does not ask the gateway to keep it when the customer opts out', async ({ page }) => {
            api = await mountLoaded(page);

            await payInvoice(page).storePaymentMethod.click();

            await expect
                .poll(async () => (await stripeElementsOptions(page)).at(-1))
                .not.toHaveProperty('setup_future_usage');
        });

        test('reports a payment the gateway refuses', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aFailedAuthorization() } },
            });
            const ui = payInvoice(page);

            await ui.payButton.click();
            await api.waitForCall('authorizePayment');

            await expect(ui.paid).toHaveCount(0);
            await expect(ui.screen).toContainText(/(fail|wrong|error|try again)/i);
        });

        test('authorizes once however often the customer submits', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    authorizePayment: { delayMs: 2000, body: aSuccessfulAuthorization() },
                },
            });
            const ui = payInvoice(page);

            await ui.payButton.click();
            await ui.payButton.click({ force: true });
            await ui.payButton.click({ force: true });

            await expect.poll(() => api.calls('authorizePayment').length).toBe(1);
        });

        test('never authorizes when the gateway rejects the card details', async ({ page }) => {
            api = await mountLoaded(page, {
                stripe: { submitError: { message: 'Your card number is incomplete.' } },
            });

            await payInvoice(page).payButton.click();
            await page.waitForTimeout(1000);

            expect(api.calls('authorizePayment')).toEqual([]);
        });
    });

    // ─── Nothing to pay with ──────────────────────────────────────────────────

    test.describe('nothing to pay with', () => {
        test('offers the invoice for download when no method can take it', async ({ page }) => {
            api = await mountPayInvoice(page, { mocks: { paymentMethodOptions: { body: [] } } });
            const ui = payInvoice(page);

            await expect(ui.downloadInvoice).toBeVisible();
            await expect(ui.payButton).toHaveCount(0);
        });

        test('downloads the invoice on request', async ({ page }) => {
            api = await mountPayInvoice(page, {
                mocks: {
                    paymentMethodOptions: { body: [] },
                    invoicePdf: { body: {} },
                },
            });

            await payInvoice(page).downloadInvoice.click();

            const pdf = await api.waitForCall('invoicePdf');
            expect(new URL(pdf.url).pathname).toBe(`/v1/portal/invoices/${INVOICE_ID}/pdf`);
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    // ─── Acceptors the invoice allows ─────────────────────────────────────────

    /**
     * Payment methods are looked up for the customer, so they carry every acceptor that customer
     * can pay through — including ones this invoice refuses. Authorizing against one of those
     * fails with a 400 the customer can do nothing about (DD-3533).
     */
    test.describe('acceptors the invoice allows', () => {
        /** Two acceptors on offer, and the invoice takes only the second of them. */
        const twoAcceptors = {
            mocks: {
                paymentMethodOptions: {
                    body: paymentMethodOptions({ gateways: ['STRIPE', 'STRIPE'] }),
                },
                authorizePayment: { body: aSuccessfulAuthorization() },
            },
            invoice: anInvoiceRecord({ paymentAcceptorIds: ['paya_test_1'] }),
        };

        test('asks the API for the acceptors this invoice can be paid through', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            expect(api.lastCall('paymentMethodOptions')?.body).toMatchObject({
                invoice_id: INVOICE_ID,
            });
        });

        test('pays through an acceptor the invoice accepts', async ({ page }) => {
            api = await mountLoaded(page, twoAcceptors);

            await payInvoice(page).payButton.click();
            const authorization = await api.waitForCall('authorizePayment');

            expect(authorization.body).toMatchObject({ payment_acceptor_id: 'paya_test_1' });
        });

        test('offers nothing on an acceptor the invoice refuses', async ({ page }) => {
            api = await mountLoaded(page, twoAcceptors);

            // Only the accepted one is mounted, so there is a single form to pay through.
            await expect(page.locator('iframe')).toHaveCount(1);
        });

        test('offers the invoice for download when it accepts none of them', async ({ page }) => {
            api = await mountPayInvoice(page, {
                invoice: anInvoiceRecord({ paymentAcceptorIds: ['paya_elsewhere'] }),
            });
            const ui = payInvoice(page);

            await expect(ui.downloadInvoice).toBeVisible();
            await expect(ui.payButton).toHaveCount(0);
        });

        // Mounted directly: with both acceptors offered there are two payment forms, and the
        // shared `stripeElement` locator insists on one.
        test('offers everything when the invoice names no acceptors', async ({ page }) => {
            api = await mountPayInvoice(page, {
                mocks: {
                    paymentMethodOptions: {
                        body: paymentMethodOptions({ gateways: ['STRIPE', 'STRIPE'] }),
                    },
                },
                invoice: anInvoiceRecord({ paymentAcceptorIds: [] }),
            });

            await expect(page.locator('iframe')).toHaveCount(2);
        });

        test('pays through the only acceptor there is, as it always has', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { authorizePayment: { body: aSuccessfulAuthorization() } },
            });

            await payInvoice(page).payButton.click();
            const authorization = await api.waitForCall('authorizePayment');

            expect(authorization.body).toMatchObject({
                payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
            });
        });
    });

    test.describe('failure modes', () => {
        test('says so when the invoice cannot be loaded', async ({ page }) => {
            api = await mountPayInvoice(page, {
                mocks: { invoice: { status: 404, body: { message: 'Not found' } } },
            });

            await expect(page.getByText(/something went wrong/i)).toBeVisible();
        });

        test('reports an invoice that cannot be loaded', async ({ page }) => {
            api = await mountPayInvoice(page, {
                mocks: { invoice: { status: 404, body: { message: 'Not found' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
            await expect(payInvoice(page).payButton).toHaveCount(0);
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountPayInvoice(page, {
                portalObject: {
                    ...(await import('../support/fixtures')).aCustomerPortalObject(),
                    type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
                },
            });

            await expect(payInvoice(page).payButton).toHaveCount(0);
            expect(api.calls('invoice')).toEqual([]);
        });
    });
});
