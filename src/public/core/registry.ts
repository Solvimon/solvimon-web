import type { Component } from 'vue';
import type { RegisteredScreenId, RegisteredComponentId } from './types';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.entry.vue';
import CustomerOverviewEntry from '@/public/screens/CustomerOverview/CustomerOverview.entry.vue';
import CheckoutEntry from '@/public/screens/Checkout/Checkout.entry.vue';
import UpgradeSubscriptionEntry from '@/public/screens/UpgradeSubscription/UpgradeSubscription.entry.vue';
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
