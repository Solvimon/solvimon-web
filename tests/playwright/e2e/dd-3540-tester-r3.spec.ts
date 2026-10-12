import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { checkout, mountCheckout, type MountOptions } from '../support/checkout';
import {
    aSubscription,
    PAYMENT_ACCEPTOR_ID,
    SUBSCRIPTION_ID,
    type Json,
} from '../support/fixtures';

/**
 * DD-3540 tester, round 3: saved seats on a redirect return, against the plan the checkout loads.
 */

const REDIRECT_QUERY = {
    redirect_status: 'failed',
    payment_acceptor_id: PAYMENT_ACCEPTOR_ID,
    payment_intent_client_secret: 'pi_3TestIntent_secret_Abc123',
};

const SEATS_PLAN = aSubscription({
    seats: [{ pricingItemConfigId: 'pico_seats', name: 'Seats', defaultNumber: '2' }],
});

function seatsOf(body: unknown): unknown {
    if (typeof body !== 'object' || body === null) return undefined;
    const customizations = Reflect.get(body, 'pricing_plan_schedule_customizations');
    return Array.isArray(customizations) ? customizations[0]?.seats_values : undefined;
}

function returnWithSaved(
    page: Page,
    seatsValues: Json,
    subscription: MountOptions['subscription'],
): Promise<ApiMock> {
    return mountCheckout(page, {
        configuration: { countryCode: 'NL' },
        subscription,
        query: REDIRECT_QUERY,
        stripe: { intentStatus: 'requires_payment_method' },
        sessionStorage: {
            [`solvimon_checkout_redirect_state:${SUBSCRIPTION_ID}`]: JSON.stringify({
                savedAt: Date.now(),
                form: { email: 'returning@example.com', seatsValues },
            }),
        },
    });
}

test.describe('DD-3540 tester r3: saved seats', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('restores the seats the customer chose, in the editor and the price', async ({ page }) => {
        api = await returnWithSaved(
            page,
            [{ pricing_item_config_id: 'pico_seats', number: '7' }],
            SEATS_PLAN,
        );

        await expect(checkout(page).email).toHaveValue('returning@example.com');
        await expect(checkout(page).seats).toHaveValue('7');
        await expect
            .poll(() => seatsOf(api.lastCall('invoicePreview')?.body))
            .toEqual([{ pricing_item_config_id: 'pico_seats', number: '7' }]);
    });

    test('keeps the plan seats when the saved ones name a config the plan lacks', async ({
        page,
    }) => {
        api = await returnWithSaved(
            page,
            [{ pricing_item_config_id: 'pico_other', number: '7' }],
            SEATS_PLAN,
        );

        await expect(checkout(page).email).toHaveValue('returning@example.com');
        await expect(checkout(page).seats).toHaveValue('2');
        await page.waitForTimeout(1000);
        await expect
            .poll(() => seatsOf(api.lastCall('invoicePreview')?.body))
            .toEqual([{ pricing_item_config_id: 'pico_seats', number: '2' }]);
    });

    // Expected failure (low): the saved form is applied once before the plan loads, and a plan
    // without seats never replaces what that first apply put in the form, so the preview (and the
    // authorization context) carry `pico_other: 7`.
    test.fail('prices no seats on a plan that has none', async ({ page }) => {
        api = await returnWithSaved(
            page,
            [{ pricing_item_config_id: 'pico_other', number: '7' }],
            aSubscription(),
        );

        await expect(checkout(page).email).toHaveValue('returning@example.com');
        await page.waitForTimeout(1000);
        for (const call of api.calls('invoicePreview')) {
            expect(seatsOf(call.body)).toBeUndefined();
        }
    });
});
