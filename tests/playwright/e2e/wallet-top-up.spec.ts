import { test, expect, type Page, type Request } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { customerOverview, mountCustomerOverview } from '../support/customerOverview';
import {
    aWalletBalance,
    anInvoiceRecord,
    DEFAULT_SCHEDULE_ID,
    paymentMethodOptions,
    walletBalances,
    type Json,
} from '../support/fixtures';

/**
 * Topping a wallet up from the customer overview, end to end against a mocked API: what the
 * customer is told when the charge or the rule fails, and which amounts are refused before any
 * charge goes out.
 */

const flexibleTopUp = (scheduleId = DEFAULT_SCHEDULE_ID): Json => ({
    pricing_item_id: 'prii_topup',
    pricing_plan_schedule_id: scheduleId,
    pricing_item: {
        id: 'prii_topup',
        configs: [
            {
                id: 'pico_topup',
                on_demand: true,
                details: {
                    pricing_type: 'FLEXIBLE',
                    bands: [
                        {
                            minimum_amount: { quantity: '10.00', currency: 'EUR' },
                            maximum_amount: { quantity: '100.00', currency: 'EUR' },
                        },
                    ],
                },
                wallet_grants: [{ wallet_type_id: 'wtyp_test' }],
            },
        ],
    },
});

const aTopUpWallet = (): Json => ({
    ...aWalletBalance({ name: 'Credits' }),
    charge_on_demand_pricing_items: [flexibleTopUp()],
});

/** Preview and charge share an endpoint; the body says which it is. */
const chargeResponder =
    (charges: MockResponse[]) =>
    (request: Request): MockResponse => {
        const body = JSON.parse(request.postData() ?? '{}');

        if (body.preview) {
            return { body: anInvoiceRecord({ id: 'inv_preview', total: '50.00' }) };
        }

        return charges.length > 1 ? charges.shift()! : charges[0];
    };

const declined: MockResponse = {
    status: 422,
    body: { message: 'Payment refused', resource_type: 'PAYMENT' },
};
const serverError: MockResponse = { status: 500, body: { message: 'Boom' } };
const charged: MockResponse = { body: anInvoiceRecord({ id: 'inv_charged', total: '50.00' }) };

async function openTopUp(page: Page, charges: MockResponse[] = [charged]): Promise<ApiMock> {
    const api = await mountCustomerOverview(page, {
        wallets: walletBalances([aTopUpWallet()]),
        mocks: {
            paymentMethodOptions: { body: paymentMethodOptions() },
            chargeOnDemandInvoice: chargeResponder([...charges]),
        },
    });

    await customerOverview(page)
        .walletBalances.getByRole('button', { name: /^top up$/i })
        .click();
    await expect(amountField(page)).toBeVisible();

    return api;
}

const amountField = (page: Page) => page.locator('input[name="top-up-amount"]');

const payButton = (page: Page) => page.getByRole('button', { name: /^top up balance/i });

const chargesSent = (api: ApiMock) =>
    api
        .calls('chargeOnDemandInvoice')
        .filter(({ body }) => !(body as { preview?: boolean }).preview);

test.describe('Wallet top-up from the customer overview', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('offers top-up and auto top-up on the overview', async ({ page }) => {
        api = await mountCustomerOverview(page, {
            wallets: walletBalances([aTopUpWallet()]),
        });
        const wallets = customerOverview(page).walletBalances;

        await expect(wallets.getByRole('button', { name: /^top up$/i })).toBeVisible();
        await expect(wallets.getByRole('button', { name: /^enable$/i })).toBeVisible();
    });

    test('tells a declined payment from a failed request, and Pay works again', async ({
        page,
    }) => {
        api = await openTopUp(page, [declined, serverError]);
        await amountField(page).fill('50');

        await payButton(page).click();
        await expect(page.getByText('Your payment was declined')).toBeVisible();
        // The library Button swallows a second click within 500ms of the first.
        await page.waitForTimeout(600);

        await payButton(page).click();
        await expect(page.getByText("We couldn't top up your wallet")).toBeVisible();
        await expect(page.getByText('Your payment was declined')).toHaveCount(0);
        expect(chargesSent(api)).toHaveLength(2);
    });

    test('forgets the failure once the modal is closed and opened again', async ({ page }) => {
        api = await openTopUp(page, [serverError]);
        await amountField(page).fill('50');
        await payButton(page).click();
        await expect(page.getByText("We couldn't top up your wallet")).toBeVisible();

        await page.getByRole('button', { name: /^cancel$/i }).click();
        await customerOverview(page)
            .walletBalances.getByRole('button', { name: /^top up$/i })
            .click();

        await expect(amountField(page)).toBeVisible();
        await expect(page.getByText("We couldn't top up your wallet")).toHaveCount(0);
    });

    for (const [typed, message] of [
        ['5', 'Top up with at least'],
        ['500', 'Top up with at most'],
        ['0', 'Top up with more than zero'],
        ['', 'Enter the amount to top up with'],
    ]) {
        test(`refuses ${JSON.stringify(typed)} before charging`, async ({ page }) => {
            api = await openTopUp(page);
            await amountField(page).fill(typed);

            await payButton(page).click();

            await page.waitForTimeout(1000);
            expect(chargesSent(api)).toHaveLength(0);
        });

        test(`says why ${JSON.stringify(typed)} is refused`, async ({ page }) => {
            api = await openTopUp(page);
            await amountField(page).fill(typed);

            await payButton(page).click();

            await expect(page.getByText(message)).toBeVisible({ timeout: 3000 });
            await expect(amountField(page)).toHaveAttribute('aria-invalid', 'true');
        });
    }

    test('says on the receipt when the rule set alongside fails to save', async ({ page }) => {
        api = await openTopUp(page);
        api.on('createAutoTopUpConfig', { status: 400, body: { message: 'Nope' } });
        await amountField(page).fill('50');
        await page.locator('.sv-top-up-form__auto-top-up input[type="checkbox"]').check({
            force: true,
        });
        await page.locator('input[name="auto-top-up-threshold"]').fill('5');
        await page.locator('input[name="auto-top-up-amount"]').fill('20');

        await payButton(page).click();

        await expect(page.getByText("couldn't save your automatic top-up")).toBeVisible();
        expect(api.lastCall('createAutoTopUpConfig')?.body).toMatchObject({
            pricing_plan_schedule_id: DEFAULT_SCHEDULE_ID,
            pricing_item_id: 'prii_topup',
        });
    });

    test('keeps the auto top-up modal open with an error when saving fails', async ({ page }) => {
        api = await mountCustomerOverview(page, {
            wallets: walletBalances([aTopUpWallet()]),
            mocks: {
                paymentMethodOptions: { body: paymentMethodOptions() },
                chargeOnDemandInvoice: chargeResponder([charged]),
                createAutoTopUpConfig: { status: 500, body: { message: 'Boom' } },
            },
        });
        await customerOverview(page)
            .walletBalances.getByRole('button', { name: /^enable$/i })
            .click();
        await page.locator('input[name="auto-top-up-threshold"]').fill('5');
        await page.locator('input[name="auto-top-up-amount"]').fill('20');

        await page.getByRole('button', { name: /^save$/i }).click();

        await expect(page.getByText("We couldn't save your automatic top-up")).toBeVisible();
        await expect(page.locator('input[name="auto-top-up-threshold"]')).toBeVisible();
    });
});

test.describe('Wallet top-up amount field', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('names the field, states its range and puts the error above the field', async ({
        page,
    }) => {
        api = await openTopUp(page);
        await expect(page.getByText('Between 10.00 and 100.00 EUR')).toBeVisible();
        await expect(page.getByRole('spinbutton', { name: /amount/i })).toBeVisible();
        await expect(amountField(page)).not.toHaveAttribute('aria-invalid', 'true');

        await amountField(page).fill('5');
        await payButton(page).click();

        const error = page.getByText('Top up with at least');
        await expect(error).toBeVisible();
        await expect(amountField(page)).toHaveAttribute('aria-invalid', 'true');
        await page
            .locator('.sv-top-up-form__amount')
            .screenshot({ path: 'tests/playwright/test-results/dd3543-amount-error.png' });

        const errorBox = await error.boundingBox();
        const fieldBox = await amountField(page).boundingBox();
        expect(!!errorBox && !!fieldBox && errorBox.y + errorBox.height <= fieldBox.y).toBe(true);
    });
});
