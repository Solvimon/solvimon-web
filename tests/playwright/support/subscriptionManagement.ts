import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    anInvoicePreview,
    aPaymentMethod,
    aSubscription,
    collection,
    paymentMethodOptions,
    SUBSCRIPTION_ID,
    type Json,
} from './fixtures';

/** A plan with a group the customer can move between, which is what this screen changes. */
export const aManageableSubscription = (): Json =>
    aSubscription({
        addons: [
            { pricingId: 'pri_small', name: 'Small pack', preselected: true },
            { pricingId: 'pri_large', name: 'Large pack' },
        ],
    });

export interface MountOptions extends ScreenOptions {
    subscription?: Json;
    paymentMethods?: Json[];
    /** What the upgrade is priced at. */
    previewTotal?: string;
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        subscription: { body: options.subscription ?? aManageableSubscription() },
        customer: { body: aCustomer() },
        paymentMethods: {
            body: collection(options.paymentMethods ?? [aPaymentMethod({ isDefault: true })]),
        },
        paymentMethodOptions: { body: paymentMethodOptions() },
        invoicePreview: { body: anInvoicePreview({ total: options.previewTotal ?? '30.00' }) },
    };
}

export function mountSubscriptionManagement(
    page: Page,
    options: MountOptions = {},
): Promise<ApiMock> {
    return mountScreen(
        page,
        'subscription-management',
        {
            ...options,
            portalObject: options.portalObject ?? aCustomerPortalObject(),
            configuration: options.configuration ?? { subscriptionId: SUBSCRIPTION_ID },
        },
        defaultMocks(options),
    );
}

export function subscriptionManagement(page: Page) {
    return {
        screen: page.locator('.sv-subscription-management'),
        title: page.locator('.sv-subscription-management__title'),
        form: page.locator('.sv-subscription-management__form'),
        summary: page.locator('.sv-subscription-management__summary'),
        updateButton: page.locator('.sv-subscription-management__update'),
        updateError: page.locator('.sv-subscription-management__update-error'),
        success: page.locator('.sv-subscription-management__success'),
        doneButton: page.locator('.sv-subscription-management__done'),
    };
}

export { hostEvents } from './screen';
