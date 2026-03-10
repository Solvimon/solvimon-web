import type { RegisteredScreenId, RegisteredComponentId } from './types';
import { defineSolvimonCustomerOverview } from '@/public/screens/CustomerOverview/CustomerOverview.entry.ce';
import { defineSolvimonCheckout } from '@/public/screens/Checkout/Checkout.entry.ce';
import { defineSolvimonInvoicesList } from '@/public/components/InvoicesList/InvoicesList.entry.ce';
import { defineSolvimonSubscriptionsList } from '@/public/components/SubscriptionsList/SubscriptionsList.entry.ce';
import { defineSolvimonCustomerPaymentMethods } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.ce';
import { defineSolvimonBillingInformation } from '@/public/components/BillingInformation/BillingInformation.entry.ce';
import { getComponentName } from '@/utils/component';

type DefineFn = () => void;

const SCREEN_DEFINERS: Record<RegisteredScreenId, DefineFn> = {
    'customer-overview': defineSolvimonCustomerOverview,
    checkout: defineSolvimonCheckout,
};

const COMPONENT_DEFINERS: Record<RegisteredComponentId, DefineFn> = {
    'invoices-list': defineSolvimonInvoicesList,
    'subscriptions-list': defineSolvimonSubscriptionsList,
    'customer-payment-methods': defineSolvimonCustomerPaymentMethods,
    'billing-information': defineSolvimonBillingInformation,
};

export function getCustomElementTagName(viewId: string): string {
    return getComponentName(viewId);
}

export function ensureCustomElementDefined(viewId: string, type: 'screen' | 'component'): void {
    const defineFn =
        type === 'screen'
            ? SCREEN_DEFINERS[viewId as RegisteredScreenId]
            : COMPONENT_DEFINERS[viewId as RegisteredComponentId];
    if (!defineFn) {
        throw new Error(
            `Solvimon: unknown ${type} id "${viewId}". Registered ${type}s: ${Object.keys(
                type === 'screen' ? SCREEN_DEFINERS : COMPONENT_DEFINERS,
            ).join(', ')}.`,
        );
    }
    defineFn();
}
