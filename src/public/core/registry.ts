import type { Component } from 'vue';
import type { RegisteredScreenId, RegisteredComponentId } from './types';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.entry.vue';
import CustomerOverviewEntry from '@/public/screens/CustomerOverview/CustomerOverview.entry.vue';
import CheckoutEntry from '@/public/screens/Checkout/Checkout.entry.vue';
import UpgradeSubscriptionEntry from '@/public/screens/UpgradeSubscription/UpgradeSubscription.entry.vue';
import PayInvoiceEntry from '@/public/screens/PayInvoice/PayInvoice.entry.vue';
import InvoiceEntry from '@/public/components/Invoice/Invoice.entry.vue';
import InvoiceDetailsEntry from '@/public/components/InvoiceDetails/InvoiceDetails.entry.vue';
import InvoicesListEntry from '@/public/components/InvoicesList/InvoicesList.entry.vue';
import PaymentHistoryEntry from '@/public/components/PaymentHistory/PaymentHistory.entry.vue';
import SubscriptionsListEntry from '@/public/components/SubscriptionsList/SubscriptionsList.entry.vue';
import SubscriptionSchedulesEntry from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.entry.vue';
import CustomerPaymentMethodsEntry from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.vue';
import WalletBalancesEntry from '@/public/components/WalletBalances/WalletBalances.entry.vue';
import BillingInformationEntry from '@/public/components/BillingInformation/BillingInformation.entry.vue';
import BillingInformationFormEntry from '@/public/components/BillingInformationForm/BillingInformationForm.entry.vue';

const SCREENS: Record<RegisteredScreenId, Component> = {
    'customer-overview': CustomerOverviewEntry,
    checkout: CheckoutEntry,
    'upgrade-subscription': UpgradeSubscriptionEntry,
    'pay-invoice': PayInvoiceEntry,
};

const COMPONENTS: Record<RegisteredComponentId, Component> = {
    invoice: InvoiceEntry,
    'invoice-details': InvoiceDetailsEntry,
    'invoices-list': InvoicesListEntry,
    'payment-history': PaymentHistoryEntry,
    'subscriptions-list': SubscriptionsListEntry,
    'subscription-schedules': SubscriptionSchedulesEntry,
    'customer-payment-methods': CustomerPaymentMethodsEntry,
    'wallet-balances': WalletBalancesEntry,
    'billing-information': BillingInformationEntry,
    'billing-information-form': BillingInformationFormEntry,
    'payment-method-form': PaymentMethodForm,
};

const REGISTERED_SCREEN_IDS = [
    'customer-overview',
    'checkout',
    'upgrade-subscription',
    'pay-invoice',
] satisfies RegisteredScreenId[];

const REGISTERED_COMPONENT_IDS = [
    'invoice',
    'invoice-details',
    'invoices-list',
    'payment-history',
    'subscriptions-list',
    'subscription-schedules',
    'customer-payment-methods',
    'wallet-balances',
    'billing-information',
    'billing-information-form',
    'payment-method-form',
] satisfies RegisteredComponentId[];

function isRegisteredScreenId(id: string): id is RegisteredScreenId {
    return Object.hasOwn(SCREENS, id);
}

function isRegisteredComponentId(id: string): id is RegisteredComponentId {
    return Object.hasOwn(COMPONENTS, id);
}

export function getScreenComponent(id: string): Component | undefined {
    return isRegisteredScreenId(id) ? SCREENS[id] : undefined;
}

export function getComponent(id: string): Component | undefined {
    return isRegisteredComponentId(id) ? COMPONENTS[id] : undefined;
}

export function getRegisteredScreenIds(): RegisteredScreenId[] {
    return [...REGISTERED_SCREEN_IDS];
}

export function getRegisteredComponentIds(): RegisteredComponentId[] {
    return [...REGISTERED_COMPONENT_IDS];
}
