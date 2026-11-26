import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { checkout, mountCheckout } from '../support/checkout';
import { customerOverview, mountCustomerOverview } from '../support/customerOverview';
import { mountPayInvoice, payInvoice } from '../support/payInvoice';
import {
    mountPaymentMethodsManagement,
    paymentMethodsManagement,
} from '../support/paymentMethodsManagement';
import { mountSubscriptionDetails, subscriptionDetails } from '../support/subscriptionDetails';
import {
    mountSubscriptionManagement,
    subscriptionManagement,
} from '../support/subscriptionManagement';

/** Every WCAG 2.1 A and AA rule axe checks, inside the elements' shadow roots too. */
async function violations(page: Page) {
    const { violations: found } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // The card fields are Stripe's frame, and the stub standing in for it is not the SDK's.
        .exclude('iframe')
        .analyze();

    return found.flatMap(({ id, impact, nodes }) =>
        nodes.map(({ html }) => `${impact} ${id}: ${html.slice(0, 160)}`),
    );
}

const loadedScreens: [string, (page: Page) => Promise<unknown>][] = [
    [
        'checkout',
        async (page) => {
            await mountCheckout(page, {
                configuration: { email: 'customer@example.com', countryCode: 'NL' },
            });
            await expect(checkout(page).orderSummary).toBeVisible();
            await expect(checkout(page).paymentForm).toBeVisible();
        },
    ],
    [
        'customer overview',
        async (page) => {
            await mountCustomerOverview(page);
            await expect(customerOverview(page).billingInformation).toBeVisible();
        },
    ],
    [
        'payment methods management',
        async (page) => {
            await mountPaymentMethodsManagement(page);
            await expect(paymentMethodsManagement(page).addButton).toBeVisible();
        },
    ],
    [
        'subscription details',
        async (page) => {
            await mountSubscriptionDetails(page);
            await expect(subscriptionDetails(page).title).toBeVisible();
        },
    ],
    [
        'subscription management',
        async (page) => {
            await mountSubscriptionManagement(page);
            await expect(subscriptionManagement(page).updateButton).toBeVisible();
        },
    ],
    [
        'pay invoice',
        async (page) => {
            await mountPayInvoice(page);
            await expect(payInvoice(page).stripeElement).toBeVisible();
        },
    ],
];

test.describe('accessibility', () => {
    for (const [name, mountLoaded] of loadedScreens) {
        test(`the ${name} has no WCAG 2.1 AA violations once loaded`, async ({ page }) => {
            await mountLoaded(page);

            expect(await violations(page)).toEqual([]);
        });
    }
});
