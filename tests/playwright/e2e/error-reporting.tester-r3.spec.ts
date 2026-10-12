import { test, expect } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import {
    hostEvents,
    mountPaymentMethodsManagement,
    paymentMethodsManagement,
} from '../support/paymentMethodsManagement';
import { aPaymentMethod } from '../support/fixtures';

/**
 * DD-3548 round 3: a default payment method the API refuses is a failure the element handles, so
 * it is logged once as REQUEST_FAILED, never as UNHANDLED_ERROR or an `error` event.
 */

test.describe('Error reporting (tester, round 3)', () => {
    let api: ApiMock;

    test.afterEach(() => {
        expect(api?.unmatchedCalls() ?? []).toEqual([]);
    });

    test('a refused default payment method is reported once and leaves the list as it was', async ({
        page,
    }) => {
        api = await mountPaymentMethodsManagement(page, {
            paymentMethods: [
                aPaymentMethod({ id: 'pmet_a', lastFourDigits: '4242', isDefault: true }),
                aPaymentMethod({ id: 'pmet_b', lastFourDigits: '1881' }),
            ],
            mocks: { updatePaymentMethod: { status: 422, body: { message: 'Refused' } } },
        });
        const ui = paymentMethodsManagement(page);
        await expect(ui.addButton).toBeVisible();
        const listCallsBefore = api.calls('paymentMethods').length;

        await ui.menuFor(1).click();
        await page.getByText('Set as default').click();
        await api.waitForCall('updatePaymentMethod');

        await expect
            .poll(async () => (await hostEvents(page)).logs.map(({ code }) => code))
            .toContain('REQUEST_FAILED');
        await page.waitForTimeout(500);

        const { logs, errors } = await hostEvents(page);
        expect(logs.filter(({ code }) => code === 'REQUEST_FAILED')).toHaveLength(1);
        expect(logs.map(({ code }) => code)).not.toContain('UNHANDLED_ERROR');
        expect(errors).toEqual([]);
        // The default that stands is still the one shown, and nothing reloaded the list.
        await expect(ui.items.first()).toContainText(/default/i);
        await expect(ui.items.last()).not.toContainText(/default/i);
        expect(api.calls('paymentMethods').length).toBe(listCallsBefore);
    });
});
