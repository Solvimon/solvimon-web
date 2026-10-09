import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    aManageableSubscription,
    aPricingPlanGroup,
    hostEvents,
    mountSubscriptionManagement,
    subscriptionManagement,
    type MountOptions,
} from '../support/subscriptionManagement';
import {
    aCustomerPortalObject,
    anInvoicePreview,
    CUSTOMER_ID,
    DEFAULT_SCHEDULE_ID,
    SUBSCRIPTION_ID,
    UPGRADE_PRICING_PLAN_ID,
} from '../support/fixtures';

/**
 * The subscription management screen, end to end against a fully mocked API. See
 * `checkout.spec.ts` for what the harness does.
 */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountSubscriptionManagement(page, options);
    await expect(subscriptionManagement(page).updateButton).toBeVisible();
    return api;
}

/** The schedule customizations out of an invoice preview payload. */
function customizationsOf(body: unknown): Record<string, unknown>[] {
    if (typeof body !== 'object' || body === null) return [];

    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    return Array.isArray(customizations) ? customizations : [];
}

test.describe('Subscription management', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('loads the subscription, the customer and what can pay for a change', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            expect(new URL(api.lastCall('subscription')!.url).pathname).toBe(
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}`,
            );
            expect(new URL(api.lastCall('customer')!.url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}`,
            );
            expect(api.lastCall('paymentMethodOptions')?.body).toEqual({
                customer_id: CUSTOMER_ID,
            });
        });

        test('prices the subscription as the running one it is', async ({ page }) => {
            api = await mountLoaded(page);

            // Priced as itself rather than as a template for a new subscription, so the customer
            // it is invoiced to is the one the API already holds.
            expect(api.lastCall('invoicePreview')?.body).toMatchObject({
                pricing_plan_subscription_id: SUBSCRIPTION_ID,
            });
            expect(customizationsOf(api.lastCall('invoicePreview')?.body)[0]).toMatchObject({
                pricing_plan_schedule_id: DEFAULT_SCHEDULE_ID,
            });
        });

        test('names the group it is about', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(subscriptionManagement(page).title).toHaveText('Manage Add-ons');
        });

        test('renders what the change comes to', async ({ page }) => {
            api = await mountLoaded(page, { previewTotal: '45.00' });

            await expect(subscriptionManagement(page).summary).toContainText('€45.00');
        });
    });

    // ─── Choosing ─────────────────────────────────────────────────────────────

    test.describe('choosing', () => {
        test('opens on what the subscription already has', async ({ page }) => {
            api = await mountLoaded(page);

            expect(customizationsOf(api.lastCall('invoicePreview')?.body)[0]).toMatchObject({
                enabled_pricings: [{ pricing_id: 'pri_small' }],
            });
            await expect(page.getByRole('radio', { name: /small pack/i })).toBeChecked();
        });

        test('opens on the pricing the host named', async ({ page }) => {
            api = await mountLoaded(page, {
                configuration: { subscriptionId: SUBSCRIPTION_ID, enabledPricingId: 'pri_large' },
            });

            await expect(page.getByRole('radio', { name: /large pack/i })).toBeChecked();
            await expect
                .poll(() => customizationsOf(api.lastCall('invoicePreview')?.body)[0])
                .toMatchObject({ enabled_pricings: [{ pricing_id: 'pri_large' }] });
        });

        test('prices the change again when the choice changes', async ({ page }) => {
            api = await mountLoaded(page);

            api.on('invoicePreview', { body: anInvoicePreview({ total: '90.00' }) });
            await subscriptionManagement(page).form.getByText('Large pack').click();

            await expect
                .poll(() => customizationsOf(api.lastCall('invoicePreview')?.body)[0])
                .toMatchObject({ enabled_pricings: [{ pricing_id: 'pri_large' }] });
            await expect(subscriptionManagement(page).summary).toContainText('€90.00');
        });
    });

    // ─── Committing the change ────────────────────────────────────────────────

    test.describe('committing the change', () => {
        test('starts a new schedule with what the customer chose', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });

            await subscriptionManagement(page).form.getByText('Large pack').click();
            await subscriptionManagement(page).updateButton.click();

            const created = await api.waitForCall('createPricingPlanSchedule');
            expect(created.body).toMatchObject({
                pricing_plan_subscription_id: SUBSCRIPTION_ID,
                // The full set, not just what changed: the new schedule replaces the old one
                // rather than being merged into it.
                enabled_pricings: [{ pricing_id: 'pri_large' }],
            });
            expect(created.body).toHaveProperty('start_at');
        });

        test('confirms the change and stops offering it', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });
            const ui = subscriptionManagement(page);

            await ui.updateButton.click();

            await expect(ui.success).toBeVisible();
            await expect(ui.form).toHaveCount(0);
            await expect(ui.updateButton).toHaveCount(0);
        });

        test('hands the customer back to the host when they are done', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });
            const ui = subscriptionManagement(page);

            await ui.updateButton.click();
            await expect(ui.doneButton).toBeVisible();
            await ui.doneButton.click();

            await expect
                .poll(async () => (await hostEvents(page)).actions.map(({ action }) => action))
                .toContain('navigate-to-customer-overview');
        });

        test('keeps the choice when the change cannot be committed', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    createPricingPlanSchedule: { status: 500, body: { message: 'Boom' } },
                },
            });
            const ui = subscriptionManagement(page);

            await ui.updateButton.click();
            await api.waitForCall('createPricingPlanSchedule');

            await expect(ui.updateError).toBeVisible();
            await expect(ui.form).toBeVisible();
            await expect(ui.updateButton).toBeEnabled();
        });

        test('reports a failed change to the host', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: {
                    createPricingPlanSchedule: { status: 500, body: { message: 'Boom' } },
                },
            });

            await subscriptionManagement(page).updateButton.click();

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
                .toContain('SUBSCRIPTION_UPDATE_FAILED');
        });
    });

    // ─── Paying for it ────────────────────────────────────────────────────────

    test.describe('paying for it', () => {
        test('cannot be committed without a method to pay with', async ({ page }) => {
            api = await mountSubscriptionManagement(page, { paymentMethods: [] });
            const ui = subscriptionManagement(page);

            await expect(ui.updateButton).toBeDisabled();
            expect(api.calls('createPricingPlanSchedule')).toEqual([]);
        });

        test('offers to add a method without losing the choice', async ({ page }) => {
            api = await mountLoaded(page);

            await subscriptionManagement(page).form.getByText('Large pack').click();
            await page.getByRole('button', { name: /add payment method/i }).click();

            await expect(
                page.frameLocator('iframe').locator('[data-testid="stripe-payment-element"]'),
            ).toBeVisible();
        });

        test('stores an added method against the customer', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { tokenizePaymentMethod: { body: { status: 'SUCCESS' } } },
            });

            await page.getByRole('button', { name: /add payment method/i }).click();
            const stripe = page
                .frameLocator('iframe')
                .locator('[data-testid="stripe-payment-element"]');
            await expect(stripe).toBeVisible();
            await page.getByRole('button', { name: /save payment method/i }).click();

            const tokenize = await api.waitForCall('tokenizePaymentMethod');
            expect(tokenize.body).toMatchObject({ customer_id: CUSTOMER_ID });
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    test.describe('failure modes', () => {
        test('reports a subscription that cannot be loaded', async ({ page }) => {
            api = await mountSubscriptionManagement(page, {
                mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
            // Nothing to commit without a subscription to commit it against.
            await expect(subscriptionManagement(page).updateButton).toBeDisabled();
        });

        test('falls back to a generic title when there is no group to name', async ({ page }) => {
            api = await mountSubscriptionManagement(page, {
                subscription: aManageableSubscription(),
                mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
            });

            await expect(subscriptionManagement(page).title).toHaveText('Manage subscription');
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountSubscriptionManagement(page, {
                portalObject: aCustomerPortalObject({ type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }),
            });

            await expect(subscriptionManagement(page).screen).toHaveCount(0);
            expect(api.calls('subscription')).toEqual([]);
        });
    });

    // ─── Changing plan ────────────────────────────────────────────────────────

    test.describe('changing plan', () => {
        test('offers the plans of the group the current plan belongs to', async ({ page }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup() });
            const ui = subscriptionManagement(page);

            expect(new URL(api.lastCall('pricingPlanGroup')!.url).pathname).toBe(
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}/pricing-plan-group`,
            );
            // Expanded, so the options are labelled off the response rather than a call per plan.
            expect(api.lastCall('pricingPlan')).toBeUndefined();
            await expect(ui.planSelector).toContainText('Workspace plans');
            await expect(ui.planSelector).toContainText('Pro plan');
            await expect(ui.planSelector).toContainText('Scale plan');
            await expect(page.getByRole('radio', { name: /pro plan/i })).toBeChecked();
        });

        // The endpoint 404s for a plan in no group, which is not a failure to report.
        test('offers no plan choice for a plan that belongs to no group', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(subscriptionManagement(page).planSelector).toHaveCount(0);
            await expect(subscriptionManagement(page).summary).toBeVisible();
        });

        test('reads the member plans by id where the group expands none', async ({ page }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup({ expanded: false }),
            });

            const plan = await api.waitForCall('pricingPlan');

            expect(new URL(plan.url).pathname).toBe(
                `/v1/portal/pricing-plans/${UPGRADE_PRICING_PLAN_ID}`,
            );
            await expect(subscriptionManagement(page).planSelector).toContainText('Scale plan');
        });

        test('offers no plan choice while the group is not active', async ({ page }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup({ status: 'DRAFT' }) });

            await expect(subscriptionManagement(page).planSelector).toHaveCount(0);
        });

        test('explains when the move lands instead of pricing it', async ({ page }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup() });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.planChangeSummary).toContainText('Moving to Scale plan');
            await expect(ui.planChangeSummary).toContainText('takes effect right away');
            await expect(ui.summary).toHaveCount(0);
        });

        test('promises the next billing period when the group times the move that way', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup({ upgradeType: 'NEXT_BILLING_PERIOD' }),
            });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.planChangeSummary).toContainText('next billing period');
        });

        test('moves the subscription to the plan the customer picked', async ({ page }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup() });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();
            await ui.updateButton.click();

            const changed = await api.waitForCall('changeSubscriptionPlan');

            expect(new URL(changed.url).pathname).toBe(
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}/change-plan`,
            );
            // The group owns the timing, so the SDK sends nothing that would override it.
            expect(changed.body).toEqual({ pricing_plan_id: UPGRADE_PRICING_PLAN_ID });
            await expect(ui.success).toContainText('Scale plan');
        });

        test('starts a new schedule instead when the plan is left alone', async ({ page }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup(),
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });

            await subscriptionManagement(page).updateButton.click();

            await api.waitForCall('createPricingPlanSchedule');
            expect(api.lastCall('changeSubscriptionPlan')).toBeUndefined();
        });

        test('leaves out a transition the merchant has closed off', async ({ page }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup({ upgradeType: 'NOT_ALLOWED' }),
            });

            // The only move out of the current plan is the one that is not allowed, so there is
            // no choice left to offer.
            await expect(subscriptionManagement(page).planSelector).toHaveCount(0);
        });

        test('keeps the choice when the move cannot be committed', async ({ page }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup(),
                mocks: { changeSubscriptionPlan: { status: 500, body: { message: 'Boom' } } },
            });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();
            await ui.updateButton.click();

            await expect(ui.updateError).toBeVisible();
            await expect(ui.success).toHaveCount(0);
            await expect(page.getByRole('radio', { name: /scale plan/i })).toBeChecked();
        });
    });
});
