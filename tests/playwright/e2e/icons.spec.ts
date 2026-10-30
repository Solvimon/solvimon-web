import { test, expect, type Page } from '@playwright/test';
import type { ApiMock } from '../support/api-mock';
import { mountCheckout } from '../support/checkout';
import { mountCustomerOverview } from '../support/customerOverview';
import { mountPayInvoice } from '../support/payInvoice';
import { mountPaymentMethodsManagement } from '../support/paymentMethodsManagement';
import { mountSubscriptionDetails } from '../support/subscriptionDetails';
import { mountSubscriptionManagement } from '../support/subscriptionManagement';

/**
 * The build keeps only the icons it finds named in the SDK's code in the sprite every element
 * fetches (`scripts/icon-sprite.mjs`). An icon named any other way would render blank, so each
 * screen is checked for icons whose symbol is missing.
 */

interface RenderedIcons {
    rendered: number;
    withoutSymbol: string[];
}

/** The icons rendered in the page's shadow roots, and those whose symbol their root lacks. */
function renderedIcons(page: Page): Promise<RenderedIcons> {
    return page.evaluate(() => {
        const roots = [...document.querySelectorAll('*')]
            .map((element) => element.shadowRoot)
            .filter((root): root is ShadowRoot => root !== null);
        const ids = roots.flatMap((root) =>
            [...root.querySelectorAll('use')].map((use) => ({
                root,
                id: (use.getAttribute('xlink:href') ?? use.getAttribute('href') ?? '').slice(1),
            })),
        );

        return {
            rendered: ids.length,
            withoutSymbol: ids
                .filter(({ root, id }) => !root.getElementById(id))
                .map(({ id }) => id),
        };
    });
}

const screens: [string, (page: Page) => Promise<ApiMock>][] = [
    ['checkout', mountCheckout],
    ['customer overview', mountCustomerOverview],
    ['pay invoice', mountPayInvoice],
    ['payment methods management', mountPaymentMethodsManagement],
    ['subscription details', mountSubscriptionDetails],
    ['subscription management', mountSubscriptionManagement],
];

test.describe('Icons', () => {
    for (const [name, mount] of screens) {
        test(`every icon the ${name} screen renders has its symbol in the sprite`, async ({
            page,
        }) => {
            await mount(page);
            await page.waitForLoadState('networkidle');

            // The sprite arrives after the first render, so the symbols are waited for, and only once
            // an icon has rendered: with none, nothing would be checked.
            await expect
                .poll(async () => {
                    const { rendered, withoutSymbol } = await renderedIcons(page);
                    return rendered ? withoutSymbol : ['no icon rendered yet'];
                })
                .toEqual([]);
        });
    }
});
