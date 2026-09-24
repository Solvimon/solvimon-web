import type { Page } from '@playwright/test';
import type { ApiMock, EndpointName, Responder } from './api-mock';
import { mountScreen, sharedMocks, type ScreenOptions } from './screen';
import {
    aCustomer,
    aCustomerPortalObject,
    anInvoiceRecord,
    aPaymentMethod,
    aSubscription,
    collection,
    walletBalances,
    type Json,
} from './fixtures';

export interface MountOptions extends ScreenOptions {
    customer?: Json;
    invoices?: Json[];
    subscriptions?: Json[];
    paymentMethods?: Json[];
    wallets?: Json;
}

function defaultMocks(options: MountOptions): Partial<Record<EndpointName, Responder>> {
    return {
        ...sharedMocks,
        customer: { body: options.customer ?? aCustomer() },
        invoices: { body: collection(options.invoices ?? [anInvoiceRecord()]) },
        subscriptions: { body: collection(options.subscriptions ?? [aSubscription()]) },
        paymentMethods: {
            body: collection(options.paymentMethods ?? [aPaymentMethod({ isDefault: true })]),
        },
        walletBalances: { body: options.wallets ?? walletBalances([]) },
    };
}

export function mountCustomerOverview(page: Page, options: MountOptions = {}): Promise<ApiMock> {
    return mountScreen(
        page,
        'customer-overview',
        { ...options, portalObject: options.portalObject ?? aCustomerPortalObject() },
        defaultMocks(options),
    );
}

export function customerOverview(page: Page) {
    return {
        screen: page.locator('.sv-customer-overview'),
        subscriptions: page.locator('.sv-customer-overview__subscriptions'),
        invoices: page.locator('.sv-customer-overview__invoices'),
        walletBalances: page.locator('.sv-customer-overview__wallet-balances'),
        paymentMethods: page.locator('.sv-customer-overview__payment-methods'),
        billingInformation: page.locator('.sv-customer-overview__billing-information'),
    };
}

export { hostEvents } from './screen';
