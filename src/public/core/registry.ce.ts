import type { RegisteredScreenId, RegisteredComponentId } from './types';
import { defineSolvimonPaymentMethodForm } from '@/public/components/PaymentMethodForm/PaymentMethodForm.entry.ce';
import { defineSolvimonCustomerOverview } from '@/public/screens/CustomerOverview/CustomerOverview.entry.ce';
import { defineSolvimonCheckout } from '@/public/screens/Checkout/Checkout.entry.ce';
import { defineSolvimonUpgradeSubscription } from '@/public/screens/UpgradeSubscription/UpgradeSubscription.entry.ce';
import { defineSolvimonPayInvoice } from '@/public/screens/PayInvoice/PayInvoice.entry.ce';
import { defineSolvimonPaymentMethodsManagement } from '@/public/screens/PaymentMethodsManagement/PaymentMethodsManagement.entry.ce';
import { defineSolvimonInvoice } from '@/public/components/Invoice/Invoice.entry.ce';
import { defineSolvimonInvoiceHeader } from '@/public/components/InvoiceHeader/InvoiceHeader.entry.ce';
import { defineSolvimonInvoiceDetails } from '@/public/components/InvoiceDetails/InvoiceDetails.entry.ce';
import { defineSolvimonInvoicesList } from '@/public/components/InvoicesList/InvoicesList.entry.ce';
import { defineSolvimonPaymentHistory } from '@/public/components/PaymentHistory/PaymentHistory.entry.ce';
import { defineSolvimonSubscriptionsList } from '@/public/components/SubscriptionsList/SubscriptionsList.entry.ce';
import { defineSolvimonSubscriptionSchedules } from '@/public/components/SubscriptionSchedules/SubscriptionSchedules.entry.ce';
import { defineSolvimonCustomerPaymentMethods } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.ce';
import { defineSolvimonWalletBalances } from '@/public/components/WalletBalances/WalletBalances.entry.ce';
import { defineSolvimonBillingInformation } from '@/public/components/BillingInformation/BillingInformation.entry.ce';
import { defineSolvimonBillingInformationForm } from '@/public/components/BillingInformationForm/BillingInformationForm.entry.ce';
import { getComponentName } from '@/utils/component';

type DefineFn = () => void;

const SCREEN_DEFINERS: Record<RegisteredScreenId, DefineFn> = {
    'customer-overview': defineSolvimonCustomerOverview,
    checkout: defineSolvimonCheckout,
    'upgrade-subscription': defineSolvimonUpgradeSubscription,
    'pay-invoice': defineSolvimonPayInvoice,
    'payment-methods-management': defineSolvimonPaymentMethodsManagement,
};

const COMPONENT_DEFINERS: Record<RegisteredComponentId, DefineFn> = {
    invoice: defineSolvimonInvoice,
    'invoice-header': defineSolvimonInvoiceHeader,
    'invoice-details': defineSolvimonInvoiceDetails,
    'invoices-list': defineSolvimonInvoicesList,
    'payment-history': defineSolvimonPaymentHistory,
    'subscriptions-list': defineSolvimonSubscriptionsList,
    'subscription-schedules': defineSolvimonSubscriptionSchedules,
    'customer-payment-methods': defineSolvimonCustomerPaymentMethods,
    'wallet-balances': defineSolvimonWalletBalances,
    'billing-information': defineSolvimonBillingInformation,
    'billing-information-form': defineSolvimonBillingInformationForm,
    'payment-method-form': defineSolvimonPaymentMethodForm,
};

function isRegisteredScreenId(id: string): id is RegisteredScreenId {
    return Object.hasOwn(SCREEN_DEFINERS, id);
}

function isRegisteredComponentId(id: string): id is RegisteredComponentId {
    return Object.hasOwn(COMPONENT_DEFINERS, id);
}

export function getCustomElementTagName(viewId: string): string {
    return getComponentName(viewId);
}

export function ensureCustomElementDefined(viewId: string, type: 'screen' | 'component'): void {
    const defineFn =
        type === 'screen'
            ? isRegisteredScreenId(viewId) && SCREEN_DEFINERS[viewId]
            : isRegisteredComponentId(viewId) && COMPONENT_DEFINERS[viewId];
    if (!defineFn) {
        throw new Error(
            `Solvimon: unknown ${type} id "${viewId}". Registered ${type}s: ${Object.keys(
                type === 'screen' ? SCREEN_DEFINERS : COMPONENT_DEFINERS,
            ).join(', ')}.`,
        );
    }
    defineFn();
}
