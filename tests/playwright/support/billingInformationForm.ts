import type { Page } from '@playwright/test';
import { installApiMock, type ApiMock, type EndpointName, type Responder } from './api-mock';
import { aCustomerPortalObject, type Json } from './fixtures';
import { sharedMocks } from './screen';

export interface MountOptions {
    customer: Json;
    mocks?: Partial<Record<EndpointName, Responder>>;
}

/**
 * The billing information form is a component, not a screen, so the test app mounts it through
 * `createComponent` when the config names a `component`.
 */
export async function mountBillingInformationForm(
    page: Page,
    { customer, mocks }: MountOptions,
): Promise<ApiMock> {
    const api = await installApiMock(page, {
        ...sharedMocks,
        customer: { body: customer },
        ...mocks,
    });

    await page.addInitScript(
        (config) => {
            Object.assign(window, { __SOLVIMON_TEST_CONFIG__: config });
        },
        {
            component: 'billing-information-form',
            environment: 'TEST',
            locale: 'en-US',
            portalObject: aCustomerPortalObject(),
            configuration: {},
        },
    );

    await page.goto('/');

    return api;
}

export function billingInformationForm(page: Page) {
    const root = page.locator('.sv-billing-form');

    return {
        root,
        email: root.locator('input[type="email"]'),
        vatNumber: root.locator('input[name="vat_number"]'),
        legalName: root.locator('input[name="legal_name"]'),
        save: root.locator('button[type="submit"]'),
    };
}
