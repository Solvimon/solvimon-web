import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    mountSubscriptionDetails,
    subscriptionDetails,
    type MountOptions,
} from '../support/subscriptionDetails';
import { aSubscription, type Json } from '../support/fixtures';

/** DD-3545 tester: which of Cancel and Renew the API would accept, and reloads that fail. */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountSubscriptionDetails(page, options);
    await expect(subscriptionDetails(page).title).toBeVisible();
    return api;
}

const withPeriods = (periods: Json[], overrides: Json = {}): Json => ({
    ...(aSubscription() as Record<string, unknown>),
    inactive_periods: periods,
    ...(overrides as Record<string, unknown>),
});

test.describe('DD-3545 tester: subscription details', () => {
    let api: ApiMock | undefined;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('offers neither while a plan change is ahead of the cancellation', async ({ page }) => {
        api = await mountLoaded(page, {
            subscription: withPeriods([
                { type: 'CANCEL', start_at: '2099-02-01T00:00:00Z' },
                { type: 'UPGRADE', start_at: '2099-01-01T00:00:00Z' },
            ]),
        });
        const ui = subscriptionDetails(page);

        await expect(ui.schedules).toBeVisible();
        await expect(ui.cancelButton).toHaveCount(0);
        await expect(ui.renewButton).toHaveCount(0);
    });

    test('offers to renew a cancellation ahead of a later plan change', async ({ page }) => {
        api = await mountLoaded(page, {
            subscription: withPeriods([
                { type: 'UPGRADE', start_at: '2099-03-01T00:00:00Z' },
                { type: 'CANCEL', start_at: '2099-02-01T00:00:00Z' },
            ]),
        });
        const ui = subscriptionDetails(page);

        await expect(ui.renewButton).toBeVisible();
        await expect(ui.cancelButton).toHaveCount(0);
    });

    test('offers neither once the cancellation has started', async ({ page }) => {
        api = await mountLoaded(page, {
            subscription: withPeriods([{ type: 'CANCEL', start_at: '2020-02-01T00:00:00Z' }]),
        });
        const ui = subscriptionDetails(page);

        await expect(ui.schedules).toBeVisible();
        await expect(ui.cancelButton).toHaveCount(0);
        await expect(ui.renewButton).toHaveCount(0);
    });

    test('offers neither for a subscription that is no longer active', async ({ page }) => {
        api = await mountLoaded(page, {
            subscription: withPeriods([], { status: 'CANCELLED' }),
        });
        const ui = subscriptionDetails(page);

        await expect(ui.schedules).toBeVisible();
        await expect(ui.cancelButton).toHaveCount(0);
        await expect(ui.renewButton).toHaveCount(0);
    });

    test('keeps the subscription on screen when reloading it after a renew fails', async ({
        page,
    }) => {
        api = await mountLoaded(page, {
            mocks: {
                subscription: [
                    { body: aSubscription({ cancelled: true }) },
                    { status: 500, body: { message: 'Boom' } },
                ],
                cancelSubscription: { body: aSubscription() },
            },
        });
        const ui = subscriptionDetails(page);

        await ui.renewButton.click();
        await page
            .getByRole('button', { name: /renew subscription/i })
            .last()
            .click();

        const renewal = await api.waitForCall('cancelSubscription');
        expect(renewal.body).toEqual({ type: 'UNDO' });
        await api.waitForCall('subscription', 2);

        await expect(ui.cancellationSuccess).toBeVisible();
        await expect(ui.schedules).toBeVisible();
        await expect(ui.error).toHaveCount(0);
    });
});
