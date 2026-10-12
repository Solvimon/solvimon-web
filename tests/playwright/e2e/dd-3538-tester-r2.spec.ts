import { test, expect } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { checkout, mountCheckout } from '../support/checkout';
import { aPortalObject, paymentMethodOptions, type Json } from '../support/fixtures';

/**
 * DD-3538 round 2, from the tester: the form is let go while Adyen waits on the customer.
 *
 * Adyen's card fields come from Adyen's hosts, so the drop-in is offered a method without fields
 * of its own, which it can submit as it is. A real challenge cannot be drawn here (the API's action
 * carries no 3DS token for Adyen to render), so a stand-in iframe is put where Adyen draws one and
 * the step handed back is one that only tells the screen the customer is being waited on.
 */

const isAdyenHost = (url: string) => /adyen\.com/.test(new URL(url).hostname);

function adyenWithoutFields(): Json[] {
    const [entry] = paymentMethodOptions({ gateways: ['ADYEN'] }) as Record<string, unknown>[];
    return [
        {
            ...entry,
            options: [
                {
                    name: 'Paysafecard',
                    payment_method_variant: 'OTHER',
                    payment_gateway_variant: 'ADYEN',
                    adyen: { name: 'Paysafecard', type: 'paysafecard' },
                },
            ],
        },
    ];
}

const customerStep = {
    status: 'ACTION_REQUIRED',
    action: {
        payment_gateway_variant: 'ADYEN',
        method: '',
        url: '',
        data: {},
        adyen: {
            result_code: 'Pending',
            action_type: 'await',
            payment_method_type: 'paysafecard',
            payment_data: 'pd_1',
        },
    },
};

test.describe('DD-3538 round 2 tester', () => {
    let api: ApiMock;

    test.afterEach(() => {
        const escaped = (api?.unmatchedCalls() ?? []).filter((call) => !isAdyenHost(call.url));
        expect(escaped).toEqual([]);
    });

    test('a step Adyen draws inside the form can be clicked, while pay stays off', async ({
        page,
    }) => {
        api = await mountCheckout(page, {
            portalObject: aPortalObject({ successUrl: '' }),
            configuration: { email: 'customer@example.com', countryCode: 'NL' },
            mocks: {
                paymentMethodOptions: { body: adyenWithoutFields() },
                authorizePayment: { body: customerStep, delayMs: 1500 },
            },
        });
        const wrapper = checkout(page).paymentForm.locator('> div').first();
        const dropIn = page.locator('.adyen-checkout__dropin');
        await expect(dropIn).toBeVisible();

        // Stands in for the challenge iframe, placed where Adyen draws it: in the drop-in's node.
        await wrapper
            .locator('div')
            .first()
            .evaluate((container) => {
                const frame = document.createElement('iframe');
                frame.setAttribute('data-testid', 'challenge');
                frame.style.cssText = 'display:block;width:300px;height:120px;border:0';
                container.after(frame);
            });
        const challenge = page.locator('[data-testid="challenge"]');

        await checkout(page).submit.click();
        await api.waitForCall('authorizePayment');

        // Held while the authorize is on its way: nothing in the form takes a pointer.
        await expect(wrapper).toHaveClass(/pointer-events-none/);
        await expect(challenge.click({ trial: true, timeout: 500 })).rejects.toThrow();

        // Let go once Adyen hands the customer a step; the button stays off and loading.
        await expect(wrapper).not.toHaveClass(/pointer-events-none/);
        await challenge.click({ trial: true, timeout: 2000 });
        await expect(checkout(page).submit).toBeDisabled();
        await expect(checkout(page).submit.locator('[role="status"]')).toBeVisible();

        await checkout(page).submit.click({ force: true });
        await page.waitForTimeout(300);
        expect(api.calls('authorizePayment')).toHaveLength(1);
    });
});
