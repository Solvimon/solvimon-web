import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    anInvoicePreview,
    aPaymentMethod,
    aPricingPlan,
    aSubscription,
    collection,
    paymentMethodOptions,
    SUBSCRIPTION_ID,
    UPGRADE_PRICING_PLAN_ID,
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
    /**
     * The group the subscription's plan belongs to, as the portal answers for it. Left out, the
     * endpoint 404s — the plan belongs to no group and no move is offered.
     */
    planGroup?: Json;
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        subscription: { body: options.subscription ?? aManageableSubscription() },
        // A plan that belongs to no group is what the endpoint 404s for, and the common case.
        pricingPlanGroup: options.planGroup
            ? { body: options.planGroup }
            : { status: 404, body: { message: 'Not found' } },
        ...(options.planGroup
            ? {
                  // Only reached where the group answers with member ids alone.
                  pricingPlan: {
                      body: aPricingPlan({ id: UPGRADE_PRICING_PLAN_ID, name: 'Scale plan' }),
                  },
                  changeSubscriptionPlan: { status: 201, body: { id: 'ppsc_plan_change' } },
              }
            : {}),
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
        planSelector: page.locator('.sv-subscription-management-form__plan'),
        planChangeSummary: page.locator('.sv-subscription-management__plan-change-summary'),
        updateButton: page.locator('.sv-subscription-management__update'),
        updateError: page.locator('.sv-subscription-management__update-error'),
        success: page.locator('.sv-subscription-management__success'),
        doneButton: page.locator('.sv-subscription-management__done'),
    };
}

export { aPricingPlanGroup } from './fixtures';
export { hostEvents } from './screen';
