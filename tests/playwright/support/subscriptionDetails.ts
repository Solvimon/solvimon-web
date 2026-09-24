import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    aPaymentMethod,
    aSubscription,
    collection,
    SUBSCRIPTION_ID,
    walletBalances,
    type Json,
} from './fixtures';

export interface MountOptions extends ScreenOptions {
    /** The subscription being viewed; defaults to a plain running monthly plan. */
    subscription?: Json;
    paymentMethods?: Json[];
    wallets?: Json;
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        subscription: { body: options.subscription ?? aSubscription() },
        customer: { body: aCustomer() },
        paymentMethods: {
            body: collection(options.paymentMethods ?? [aPaymentMethod({ isDefault: true })]),
        },
        walletBalances: { body: options.wallets ?? walletBalances([]) },
    };
}

export function mountSubscriptionDetails(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    return mountScreen(
        page,
        'subscription-details',
        {
            ...options,
            portalObject: options.portalObject ?? aCustomerPortalObject(),
            configuration: options.configuration ?? { subscriptionId: SUBSCRIPTION_ID },
        },
        defaultMocks(options),
    );
}

export function subscriptionDetails(page: Page) {
    return {
        screen: page.locator('.sv-subscription-details'),
        title: page.locator('.sv-subscription-details__title'),
        cancelButton: page.locator('.sv-subscription-details__cancel'),
        renewButton: page.locator('.sv-subscription-details__renew'),
        cancellationSuccess: page.locator('.sv-subscription-details__cancellation-success'),
        error: page.locator('.sv-subscription-details__error'),
        schedules: page.locator('.sv-subscription-details__schedules'),
        emptyState: page.locator('.sv-subscription-details__empty-state'),
        walletBalances: page.locator('.sv-subscription-details__wallet-balances'),
        paymentMethod: page.locator('.sv-subscription-details__payment-method'),
        upgrades: page.locator('.sv-subscription-details__upgrades'),
    };
}

export { hostEvents } from './screen';
