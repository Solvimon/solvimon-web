import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    customerOverview,
    mountCustomerOverview,
    type MountOptions,
} from '../support/customerOverview';
import { anInvoiceRecord, collection } from '../support/fixtures';

/** The invoices block of the customer overview: payability, its row buttons, dates and paging. */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCustomerOverview(page, options);
    await expect(customerOverview(page).billingInformation).toBeVisible();
    return api;
}

const firstPage = [1, 2, 3, 4, 5].map((n) =>
    anInvoiceRecord({ id: `inv_${n}`, number: `INV-${n}` }),
);
const withNextPage = {
    ...collection(firstPage),
    links: { current: '/v1/portal/invoices?page=1', next: '/v1/portal/invoices?page=2' },
};

test.describe('Invoices list', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('offers Pay on a partly paid invoice and not on a paid or overpaid one', async ({
        page,
    }) => {
        api = await mountLoaded(page, {
            invoices: [
                {
                    ...anInvoiceRecord({ id: 'inv_1', number: 'INV-1', openAmount: '5.00' }),
                    payment_status: 'PARTIALLY_PAID',
                },
                {
                    ...anInvoiceRecord({ id: 'inv_2', number: 'INV-2', openAmount: '0.00' }),
                    paid: null,
                    payment_status: 'PAID',
                },
                {
                    ...anInvoiceRecord({ id: 'inv_3', number: 'INV-3', openAmount: '-5.00' }),
                    paid: null,
                    payment_status: 'OVERPAID',
                },
            ],
        });
        const invoices = customerOverview(page).invoices;

        await expect(invoices).toContainText('INV-3');
        await expect(invoices.getByRole('button', { name: /^pay$/i })).toHaveCount(1);
        await expect(invoices.getByText('Paid', { exact: true })).toHaveCount(2);
    });

    test('lets the keyboard reach each row by the invoice it opens', async ({ page }) => {
        api = await mountLoaded(page, {
            invoices: [
                anInvoiceRecord({ id: 'inv_1', number: 'INV-1' }),
                anInvoiceRecord({ id: 'inv_2', number: 'INV-2' }),
            ],
        });
        const invoices = customerOverview(page).invoices;

        await expect(invoices.getByRole('button', { name: /^View invoice INV-\d$/ })).toHaveCount(
            2,
        );
        await invoices.getByRole('button', { name: 'View invoice INV-1' }).focus();
        await page.keyboard.press('Tab');
        await expect(invoices.getByRole('button', { name: /^pay$/i }).first()).toBeFocused();
    });

    test('dates an invoice in its own timezone, not the customer one', async ({ page }) => {
        api = await mountLoaded(page, {
            invoices: [
                {
                    ...anInvoiceRecord({ id: 'inv_1', number: 'INV-1' }),
                    // Already the 15th in Amsterdam, still the 14th in UTC.
                    invoice_date: '2026-01-14T23:30:00Z',
                    timezone: 'UTC',
                },
            ],
        });
        const invoices = customerOverview(page).invoices;

        await expect(invoices).toContainText('Jan 14, 2026');
        await expect(invoices).not.toContainText('Jan 15, 2026');
    });

    test('shows that the next invoices are loading, then lists them', async ({ page }) => {
        api = await mountLoaded(page, {
            mocks: {
                invoices: [
                    { body: withNextPage },
                    {
                        delayMs: 1500,
                        body: collection([anInvoiceRecord({ id: 'inv_6', number: 'INV-6' })]),
                    },
                ],
            },
        });
        const invoices = customerOverview(page).invoices;
        const loadMore = invoices.getByRole('button', { name: /load more/i });

        await loadMore.click();
        await expect(loadMore).toBeDisabled();
        await expect(invoices).toContainText('INV-6');
        expect(new URL(api.lastCall('invoices')!.url).searchParams.get('page')).toBe('2');
    });
});
