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
    aPaymentMethod,
    CUSTOMER_ID,
    DEFAULT_SCHEDULE_ID,
    SUBSCRIPTION_ID,
    type Json,
    PRICING_PLAN_ID,
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

/** Picks something the subscription does not have yet, which is all that can be committed. */
async function chooseLargePack(page: Page): Promise<void> {
    await subscriptionManagement(page).form.getByText('Large pack').click();
    await expect(subscriptionManagement(page).updateButton).toBeEnabled();
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
        test('loads the subscription and what can pay for a change', async ({ page }) => {
            api = await mountLoaded(page);

            expect(new URL((await api.waitForCall('subscription')).url).pathname).toBe(
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}`,
            );
            expect((await api.waitForCall('paymentMethodOptions')).body).toEqual({
                customer_id: CUSTOMER_ID,
            });
        });

        test('prices the subscription as the running one it is', async ({ page }) => {
            api = await mountLoaded(page);

            // Priced as itself rather than as a template for a new subscription, so the customer
            // it is invoiced to is the one the API already holds.
            expect((await api.waitForCall('invoicePreview')).body).toMatchObject({
                pricing_plan_subscription_id: SUBSCRIPTION_ID,
            });
            expect(
                customizationsOf((await api.waitForCall('invoicePreview')).body)[0],
            ).toMatchObject({
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

            expect(
                customizationsOf((await api.waitForCall('invoicePreview')).body)[0],
            ).toMatchObject({
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

            await chooseLargePack(page);
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

        test('commits when Enter is pressed in the form', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });

            await chooseLargePack(page);
            await page.getByRole('radio', { name: /large pack/i }).press('Enter');

            await api.waitForCall('createPricingPlanSchedule');
        });

        test('does not start a schedule the subscription already has', async ({ page }) => {
            api = await mountLoaded(page);

            await expect(subscriptionManagement(page).updateButton).toBeDisabled();
            expect(api.calls('createPricingPlanSchedule')).toEqual([]);
        });

        test('waits for the price of the change before committing it', async ({ page }) => {
            api = await mountLoaded(page);
            api.on('invoicePreview', { status: 500, body: { message: 'Boom' } });

            await subscriptionManagement(page).form.getByText('Large pack').click();
            await api.waitForCall('invoicePreview');

            await expect(subscriptionManagement(page).updateButton).toBeDisabled();
        });

        test('confirms the change and stops offering it', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { createPricingPlanSchedule: { body: { id: 'ppsc_new' } } },
            });
            const ui = subscriptionManagement(page);

            await chooseLargePack(page);
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

            await chooseLargePack(page);
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

            await chooseLargePack(page);
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

            await chooseLargePack(page);
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

        test("offers only the subscription's own method, the one the API charges", async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                paymentMethods: [
                    aPaymentMethod({ id: 'pmet_other', isDefault: true }),
                    aPaymentMethod(),
                ],
            });
            const form = subscriptionManagement(page).form;

            await expect(
                form.getByRole('group', { name: 'Payment method' }).getByRole('radio'),
            ).toHaveCount(1);
            await expect(page.getByRole('button', { name: /add payment method/i })).toHaveCount(0);
        });

        test('says so when the subscription has no method to charge', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [aPaymentMethod({ id: 'pmet_other', isDefault: true })],
            });

            await expect(
                subscriptionManagement(page).form.locator(
                    '.sv-subscription-management-form__no-payment-method',
                ),
            ).toBeVisible();
            await expect(subscriptionManagement(page).updateButton).toBeDisabled();
        });

        test('offers no method the API would refuse to charge', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [aPaymentMethod({ isDefault: true, status: 'INACTIVE' })],
            });
            const ui = subscriptionManagement(page);

            await expect(
                ui.form.locator('.sv-subscription-management-form__no-payment-method'),
            ).toBeVisible();
            await ui.form.getByText('Large pack').click();
            await expect(ui.updateButton).toBeDisabled();
            await expect(ui.updateButton).toHaveAccessibleDescription(/no payment method/i);
        });
    });

    // ─── Customized pricing ───────────────────────────────────────────────────

    test.describe('customized pricing', () => {
        /** The small pack is customized for this subscription, so it bills under an id of its own. */
        function aCustomizedSubscription(): Json {
            const subscription = aManageableSubscription();
            const infos = subscription.pricing_plan_schedule_infos as Json[];

            return {
                ...subscription,
                pricing_plan_schedule_infos: infos.map((info) => ({
                    ...info,
                    pricing_plan_schedule: {
                        ...(info.pricing_plan_schedule as Json),
                        enabled_pricings: [],
                        override_pricings: [
                            { id: 'pri_small_custom', original_pricing_id: 'pri_small' },
                        ],
                    },
                })),
            };
        }

        test('says to contact support rather than drop the customization', async ({ page }) => {
            api = await mountLoaded(page, { subscription: aCustomizedSubscription() });
            const ui = subscriptionManagement(page);

            await expect(
                page.locator('.sv-subscription-management__customized-pricing'),
            ).toBeVisible();
            await expect(ui.form).toHaveCount(0);
            await expect(ui.updateButton).toBeDisabled();
            await expect(ui.updateButton).toHaveAccessibleDescription(/contact support/i);
            expect(api.calls('invoicePreview')).toEqual([]);
            expect(api.calls('createPricingPlanSchedule')).toEqual([]);
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
            await expect(page.locator('.sv-subscription-management__load-error')).toBeVisible();
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
            await expect(ui.planSelector).toContainText('Pick your plan');
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

        test('explains when the move lands and what it comes to', async ({ page }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup(),
                planChangeTotal: '72.50',
            });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.planChangeSummary).toContainText('Moving to Scale plan');
            await expect(ui.planChangeSummary).toContainText('takes effect right away');
            await expect(ui.summary).toContainText('€72.50');
        });

        test('prices the move with what change-plan would be sent', async ({ page }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup() });

            await subscriptionManagement(page).planSelector.getByText('Scale plan').click();

            const preview = await api.waitForCall('changePlanInvoicePreview');
            expect(preview.body).toEqual({
                pricing_plan_subscription_id: SUBSCRIPTION_ID,
                pricing_plan_id: UPGRADE_PRICING_PLAN_ID,
            });
        });

        test('does not move the subscription while its price cannot be loaded', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup(),
                mocks: { changePlanInvoicePreview: { status: 500, body: { message: 'boom' } } },
            });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.summary).toContainText('Unable to calculate the total');
            await expect(ui.updateButton).toBeDisabled();
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

        test('offers to upgrade the plan when the plan picked is higher in the group', async ({
            page,
        }) => {
            api = await mountLoaded(page, { planGroup: aPricingPlanGroup() });
            const ui = subscriptionManagement(page);

            await expect(ui.updateButton).toHaveText('Your current plan');
            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.updateButton).toHaveText('Upgrade plan');
        });

        test('offers to downgrade the plan when the plan picked is lower in the group', async ({
            page,
        }) => {
            api = await mountLoaded(page, {
                planGroup: aPricingPlanGroup({
                    members: [
                        { pricing_plan_id: UPGRADE_PRICING_PLAN_ID, order: 1 },
                        { pricing_plan_id: PRICING_PLAN_ID, order: 2 },
                    ],
                }),
            });
            const ui = subscriptionManagement(page);

            await ui.planSelector.getByText('Scale plan').click();

            await expect(ui.updateButton).toHaveText('Downgrade plan');
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

            await chooseLargePack(page);
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
