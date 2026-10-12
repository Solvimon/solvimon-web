import { test, expect, type Page, type Request } from '@playwright/test';
import type { ApiMock, MockResponse } from '../support/api-mock';
import { checkout, mountCheckout, type MountOptions } from '../support/checkout';
import { anInvoicePreview } from '../support/fixtures';

/** DD-3553: the promotion code announcement, Enter in its field, and the 640px breakpoint. */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountCheckout(page, {
        configuration: { email: 'customer@example.com', countryCode: 'NL' },
        ...options,
    });
    await expect(checkout(page).paymentForm).toBeVisible();
    return api;
}

const promotionCodesOf = (request: Request): unknown => {
    const body: unknown = request.postDataJSON();
    if (typeof body !== 'object' || body === null) return undefined;
    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    if (!Array.isArray(customizations)) return undefined;
    return customizations.map((c) => Reflect.get(Object(c), 'promotion_codes')).find(Boolean);
};

const hasCode = (request: Request, code: string) =>
    JSON.stringify(promotionCodesOf(request) ?? []).includes(code);

const accepted = (delayMs = 0): MockResponse => ({
    body: anInvoicePreview({ total: '15.00' }),
    delayMs,
});
const rejected = (delayMs = 0): MockResponse => ({
    status: 400,
    body: { message: 'Unknown promotion code', field: 'promotion_codes' },
    delayMs,
});

const liveRegion = (page: Page) =>
    page.locator('.sv-checkout__promotion-code + span[aria-live="polite"]');

async function openField(page: Page, code: string) {
    await page
        .getByRole('button', { name: /promotion code/i })
        .first()
        .click();
    await page.getByRole('textbox', { name: /promotion code/i }).fill(code);
}

test.describe('Checkout promotion code (DD-3553)', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('Enter applies the code with one preview, announced only once it is accepted', async ({
        page,
    }) => {
        api = await mountLoaded(page);
        const before = api.calls('invoicePreview').length;
        api.on('invoicePreview', accepted(1500));

        await openField(page, 'SUMMER');
        await page.getByRole('textbox', { name: /promotion code/i }).press('Enter');

        await expect(checkout(page).promotionCode).toContainText('SUMMER');
        await expect(liveRegion(page)).toHaveText('');

        await expect(liveRegion(page)).toHaveText('Promotion code applied');
        expect(api.calls('invoicePreview').length - before).toBe(1);
    });

    test('Apply still applies on click', async ({ page }) => {
        api = await mountLoaded(page);
        api.on('invoicePreview', accepted());

        await openField(page, 'SUMMER');
        await page.getByRole('button', { name: /apply promotion code/i }).click();

        await expect(liveRegion(page)).toHaveText('Promotion code applied');
    });

    test('announces nothing for a code the API turns down, and shows the error', async ({
        page,
    }) => {
        api = await mountLoaded(page);
        api.on('invoicePreview', (request) =>
            hasCode(request, 'NOPE') ? rejected(800) : accepted(),
        );

        await openField(page, 'NOPE');
        await page.getByRole('textbox', { name: /promotion code/i }).press('Enter');

        await expect(checkout(page).promotionError).toBeVisible();
        await expect(liveRegion(page)).toHaveText('');
    });

    test('announces only the removal when the code is removed mid-apply', async ({ page }) => {
        api = await mountLoaded(page);
        api.on('invoicePreview', (request) =>
            hasCode(request, 'SUMMER') ? accepted(1500) : accepted(),
        );

        await openField(page, 'SUMMER');
        await page.getByRole('textbox', { name: /promotion code/i }).press('Enter');
        await page.getByRole('button', { name: /remove promotion code/i }).click();

        await expect(liveRegion(page)).toHaveText('Promotion code removed');
        await page.waitForTimeout(2000);
        await expect(liveRegion(page)).toHaveText('Promotion code removed');
    });

    test('Enter in another field applies no code', async ({ page }) => {
        // No configured email, so the email field is editable and can take the key itself.
        api = await mountCheckout(page, { configuration: { countryCode: 'NL' } });
        await expect(checkout(page).email).toBeEditable();
        const before = api.calls('invoicePreview').length;

        // A code typed but not applied must stay unapplied when Enter is pressed elsewhere.
        await openField(page, 'SUMMER');
        await checkout(page).email.fill('customer@example.com');
        await checkout(page).email.press('Enter');
        await page.waitForTimeout(500);

        const after = api.calls('invoicePreview').slice(before);
        expect(
            after.filter((call) => JSON.stringify(call.body).includes('promotion_codes')),
        ).toEqual([]);
        await expect(liveRegion(page)).toHaveText('');
    });

    // `usePromotionCode` keeps one pending flag for apply and remove. A removal that settles while
    // the next apply is still out drops it, and the section announces a code nobody accepted yet.
    test.fail(
        'does not announce a code whose preview is still out after a slow removal',
        async ({ page }) => {
            api = await mountLoaded(page);
            api.on('invoicePreview', (request) => {
                if (hasCode(request, 'NOPE')) return rejected(4000);
                if (hasCode(request, 'SUMMER')) return accepted();
                return accepted(1500);
            });

            await openField(page, 'SUMMER');
            await page.getByRole('textbox', { name: /promotion code/i }).press('Enter');
            await expect(liveRegion(page)).toHaveText('Promotion code applied');

            await page.getByRole('button', { name: /remove promotion code/i }).click();
            await openField(page, 'NOPE');
            await page.getByRole('textbox', { name: /promotion code/i }).press('Enter');

            // The removal answers at ~1.5s, the NOPE preview only at ~4s (and is then rejected).
            await page.waitForTimeout(2500);
            await expect(liveRegion(page)).not.toHaveText('Promotion code applied', {
                timeout: 100,
            });
        },
    );
});

test.describe('Checkout layout at the sm breakpoint (DD-3553)', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('639px shows the mobile order summary', async ({ page }) => {
        await page.setViewportSize({ width: 639, height: 900 });
        api = await mountLoaded(page);

        await expect(page.locator('.sv-checkout__mobile-order-summary')).toBeVisible();
    });

    test('640px is the desktop layout: no mobile order summary', async ({ page }) => {
        await page.setViewportSize({ width: 640, height: 900 });
        api = await mountLoaded(page);

        await expect(checkout(page).orderSummary).toBeVisible();
        await expect(page.locator('.sv-checkout__mobile-order-summary')).toHaveCount(0);
    });
});
