import type { Component } from 'vue';
import type { RegisteredScreenId, RegisteredComponentId } from './types';
import CustomerOverviewEntry from '@/public/screens/CustomerOverview/CustomerOverview.entry.vue';
import CheckoutEntry from '@/public/screens/Checkout/Checkout.entry.vue';
import InvoiceEntry from '@/public/components/Invoice/Invoice.entry.vue';
import InvoiceDetailsEntry from '@/public/components/InvoiceDetails/InvoiceDetails.entry.vue';
import InvoicesListEntry from '@/public/components/InvoicesList/InvoicesList.entry.vue';
import PaymentHistoryEntry from '@/public/components/PaymentHistory/PaymentHistory.entry.vue';
import SubscriptionsListEntry from '@/public/components/SubscriptionsList/SubscriptionsList.entry.vue';
import CustomerPaymentMethodsEntry from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.vue';
import BillingInformationEntry from '@/public/components/BillingInformation/BillingInformation.entry.vue';

const SCREENS: Record<RegisteredScreenId, Component> = {
    'customer-overview': CustomerOverviewEntry,
    checkout: CheckoutEntry,
};

const COMPONENTS: Record<RegisteredComponentId, Component> = {
    invoice: InvoiceEntry,
    'invoice-details': InvoiceDetailsEntry,
    'invoices-list': InvoicesListEntry,
    'payment-history': PaymentHistoryEntry,
    'subscriptions-list': SubscriptionsListEntry,
    'customer-payment-methods': CustomerPaymentMethodsEntry,
    'billing-information': BillingInformationEntry,
};

export function getScreenComponent(id: string): Component | undefined {
    return SCREENS[id as RegisteredScreenId];
}

export function getComponent(id: string): Component | undefined {
    return COMPONENTS[id as RegisteredComponentId];
}

export function getRegisteredScreenIds(): RegisteredScreenId[] {
    return Object.keys(SCREENS) as RegisteredScreenId[];
}

export function getRegisteredComponentIds(): RegisteredComponentId[] {
    return Object.keys(COMPONENTS) as RegisteredComponentId[];
}
