import { test, expect } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { customerOverview, hostEvents, mountCustomerOverview } from '../support/customerOverview';
import { aSubscription, type Json } from '../support/fixtures';

/** DD-3553 moved the ACTIVE_SCHEDULE_NOT_FOUND watcher into `useActiveScheduleWarning`. */

const startingIn = (days: number): Json => {
    const subscription = aSubscription() as Record<string, unknown>;
    const startAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const infos = subscription.pricing_plan_schedule_infos as Record<string, unknown>[];

    return {
        ...subscription,
        pricing_plan_schedule_infos: infos.map((info) => ({
            ...info,
            start_at: startAt,
            end_at: undefined,
        })),
    };
};

const warnings = async (page: Parameters<typeof hostEvents>[0]) =>
    (await hostEvents(page)).logs.filter(({ code }) => code === 'ACTIVE_SCHEDULE_NOT_FOUND');

test.describe('Customer overview: ACTIVE_SCHEDULE_NOT_FOUND (DD-3553)', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('warns once when no schedule is billed right now', async ({ page }) => {
        api = await mountCustomerOverview(page, { subscriptions: [startingIn(30)] });
        await expect(customerOverview(page).subscriptions).toBeVisible();
        await page.waitForTimeout(1000);

        const found = await warnings(page);
        expect(found).toHaveLength(1);
        expect(found[0].level).toBe('warn');
    });

    test('says nothing when a schedule is billed right now', async ({ page }) => {
        api = await mountCustomerOverview(page);
        await expect(customerOverview(page).subscriptions).toBeVisible();
        await page.waitForTimeout(1000);

        expect(await warnings(page)).toHaveLength(0);
    });

    test('says nothing for a customer without subscriptions', async ({ page }) => {
        api = await mountCustomerOverview(page, { subscriptions: [] });
        await expect(customerOverview(page).screen).toBeVisible();
        await page.waitForTimeout(1000);

        expect(await warnings(page)).toHaveLength(0);
    });
});
