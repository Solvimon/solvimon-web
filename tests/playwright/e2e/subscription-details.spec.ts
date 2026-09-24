import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountSubscriptionDetails,
    subscriptionDetails,
    type MountOptions,
} from '../support/subscriptionDetails';
import {
    aCustomerPortalObject,
    aPaymentMethod,
    aSubscription,
    aWalletBalance,
    CUSTOMER_ID,
    PAYMENT_METHOD_ID,
    SUBSCRIPTION_ID,
    walletBalances,
} from '../support/fixtures';

/**
 * The subscription details screen, end to end against a fully mocked API. See `checkout.spec.ts`
 * for what the harness does.
 */

async function mountLoaded(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    const api = await mountSubscriptionDetails(page, options);
    await expect(subscriptionDetails(page).title).toBeVisible();
    return api;
}

test.describe('Subscription details', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    // ─── Bootstrap ────────────────────────────────────────────────────────────

    test.describe('bootstrap', () => {
        test('loads the subscription the host named, expanded', async ({ page }) => {
            api = await mountLoaded(page);

            const url = new URL(api.lastCall('subscription')!.url);
            expect(url.pathname).toBe(`/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}`);
            expect(url.searchParams.getAll('expand[]')).toEqual(['ALL']);
        });

        test('loads the customer it belongs to, their methods and their wallets', async ({
            page,
        }) => {
            api = await mountLoaded(page);

            expect(new URL(api.lastCall('customer')!.url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}`,
            );
            expect(
                new URL(api.lastCall('paymentMethods')!.url).searchParams.get('customer_id'),
            ).toBe(CUSTOMER_ID);
            expect(new URL(api.lastCall('walletBalances')!.url).pathname).toBe(
                `/v1/portal/customers/${CUSTOMER_ID}/wallets/balance`,
            );
        });

        test('renders the plan and its schedules', async ({ page }) => {
            api = await mountLoaded(page, { subscription: aSubscription({ name: 'Growth plan' }) });
            const ui = subscriptionDetails(page);

            await expect(ui.title).toHaveText('Growth plan');
            await expect(ui.schedules).toBeVisible();
        });

        test('renders the method the subscription is billed to', async ({ page }) => {
            api = await mountLoaded(page, {
                paymentMethods: [
                    aPaymentMethod({ id: PAYMENT_METHOD_ID, lastFourDigits: '4242' }),
                    aPaymentMethod({ id: 'pmet_other', lastFourDigits: '1881' }),
                ],
            });
            const ui = subscriptionDetails(page);

            // Only the one the subscription names, not every method the customer has.
            await expect(ui.paymentMethod).toContainText('4242');
            await expect(ui.paymentMethod).not.toContainText('1881');
        });

        test('renders the wallets the customer holds', async ({ page }) => {
            api = await mountLoaded(page, {
                wallets: walletBalances([aWalletBalance({ name: 'Credits' })]),
            });

            await expect(subscriptionDetails(page).walletBalances).toContainText('Credits');
        });

        test('renders no wallets for a customer with none', async ({ page }) => {
            api = await mountLoaded(page, { wallets: walletBalances([]) });

            await expect(subscriptionDetails(page).walletBalances).toHaveCount(0);
        });

        test('sends the access token on every call', async ({ page }) => {
            api = await mountLoaded(page);

            [
                api.lastCall('subscription'),
                api.lastCall('customer'),
                api.lastCall('paymentMethods'),
                api.lastCall('walletBalances'),
            ].forEach((call) => expect(call?.headers['authorization']).toMatch(/^Bearer .+/));
        });
    });

    // ─── Cancelling ───────────────────────────────────────────────────────────

    test.describe('cancelling', () => {
        test('offers to cancel a running subscription', async ({ page }) => {
            api = await mountLoaded(page);
            const ui = subscriptionDetails(page);

            await expect(ui.cancelButton).toBeVisible();
            await expect(ui.renewButton).toHaveCount(0);
        });

        test('asks before cancelling', async ({ page }) => {
            api = await mountLoaded(page);

            await subscriptionDetails(page).cancelButton.click();

            await expect(
                page.getByRole('button', { name: /cancel subscription/i }).last(),
            ).toBeVisible();
            expect(api.calls('cancelSubscription')).toEqual([]);
        });

        test('cancels at the end of the billing period once confirmed', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { cancelSubscription: { body: aSubscription({ cancelled: true }) } },
            });

            await subscriptionDetails(page).cancelButton.click();
            await page
                .getByRole('button', { name: /cancel subscription/i })
                .last()
                .click();

            const cancellation = await api.waitForCall('cancelSubscription');
            expect(new URL(cancellation.url).pathname).toBe(
                `/v1/portal/pricing-plan-subscriptions/${SUBSCRIPTION_ID}/cancel`,
            );
            // The customer keeps what they paid for until the period they paid for ends.
            expect(cancellation.body).toEqual({ type: 'NEXT_BILLING_PERIOD' });
        });

        test('confirms the cancellation and loads the subscription again', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { cancelSubscription: { body: aSubscription({ cancelled: true }) } },
            });
            const ui = subscriptionDetails(page);
            const before = api.calls('subscription').length;

            await ui.cancelButton.click();
            await page
                .getByRole('button', { name: /cancel subscription/i })
                .last()
                .click();

            await expect(ui.cancellationSuccess).toBeVisible();
            await expect.poll(() => api.calls('subscription').length).toBeGreaterThan(before);
        });

        test('keeps the subscription when the cancellation fails', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { cancelSubscription: { status: 500, body: { message: 'Boom' } } },
            });
            const ui = subscriptionDetails(page);

            await ui.cancelButton.click();
            await page
                .getByRole('button', { name: /cancel subscription/i })
                .last()
                .click();
            await api.waitForCall('cancelSubscription');

            await expect(ui.cancellationSuccess).toHaveCount(0);
            await expect(ui.cancelButton).toBeVisible();
        });
    });

    // ─── Renewing ─────────────────────────────────────────────────────────────

    test.describe('renewing', () => {
        test('offers to renew a subscription that has been cancelled', async ({ page }) => {
            api = await mountLoaded(page, { subscription: aSubscription({ cancelled: true }) });
            const ui = subscriptionDetails(page);

            await expect(ui.renewButton).toBeVisible();
            await expect(ui.cancelButton).toHaveCount(0);
        });

        test('undoes the cancellation once confirmed', async ({ page }) => {
            api = await mountLoaded(page, {
                subscription: aSubscription({ cancelled: true }),
                mocks: { cancelSubscription: { body: aSubscription() } },
            });

            await subscriptionDetails(page).renewButton.click();
            await page
                .getByRole('button', { name: /renew subscription/i })
                .last()
                .click();

            const renewal = await api.waitForCall('cancelSubscription');
            expect(renewal.body).toEqual({ type: 'UNDO' });
        });
    });

    // ─── Failure modes ────────────────────────────────────────────────────────

    test.describe('failure modes', () => {
        test('says so when the subscription cannot be loaded', async ({ page }) => {
            api = await mountSubscriptionDetails(page, {
                mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
            });

            await expect(subscriptionDetails(page).error).toBeVisible();
        });

        test('says so when the wallets cannot be loaded', async ({ page }) => {
            api = await mountLoaded(page, {
                mocks: { walletBalances: { status: 500, body: { message: 'Boom' } } },
            });

            await expect(page.getByText(/could not load wallet balances/i)).toBeVisible();
            // The rest of the screen is unaffected: one failed block is not the whole screen.
            await expect(subscriptionDetails(page).schedules).toBeVisible();
        });

        test('reports a failed load to the host', async ({ page }) => {
            api = await mountSubscriptionDetails(page, {
                mocks: { subscription: { status: 404, body: { message: 'Not found' } } },
            });

            await expect
                .poll(async () => (await hostEvents(page)).logs.map(({ level }) => level))
                .toContain('error');
        });

        test('refuses a portal object meant for another screen', async ({ page }) => {
            api = await mountSubscriptionDetails(page, {
                portalObject: aCustomerPortalObject({ type: 'INIT_PRICING_PLAN_SUBSCRIPTION' }),
            });

            await expect(subscriptionDetails(page).screen).toHaveCount(0);
            expect(api.calls('subscription')).toEqual([]);
        });
    });
});
