import type { RegisteredScreenId, RegisteredComponentId } from './types';
import { getComponentName } from '@/utils/component';

type DefineFn = (tagName?: string) => void;
type DefineLoader = () => Promise<DefineFn>;

/**
 * Each entry is reached through `import()` rather than named at the top of this file.
 *
 * A static import here puts every screen and component in the graph of anything that touches the
 * core, and because each one is referenced from the lookup below, no bundler can prove them
 * unreachable: mounting a single component pulled in all eighteen, Adyen and Stripe included. As
 * loaders they are separate chunks, and a host downloads only what it mounts.
 */
const SCREEN_LOADERS: Record<RegisteredScreenId, DefineLoader> = {
    'customer-overview': () =>
        import('@/public/screens/CustomerOverview/CustomerOverview.entry.ce').then(
            (module) => module.defineSolvimonCustomerOverview,
        ),
    checkout: () =>
        import('@/public/screens/Checkout/Checkout.entry.ce').then(
            (module) => module.defineSolvimonCheckout,
        ),
    'subscription-management': () =>
        import('@/public/screens/SubscriptionManagement/SubscriptionManagement.entry.ce').then(
            (module) => module.defineSolvimonSubscriptionManagement,
        ),
    'subscription-details': () =>
        import('@/public/screens/SubscriptionDetails/SubscriptionDetails.entry.ce').then(
            (module) => module.defineSolvimonSubscriptionDetails,
        ),
    'pay-invoice': () =>
        import('@/public/screens/PayInvoice/PayInvoice.entry.ce').then(
            (module) => module.defineSolvimonPayInvoice,
        ),
    'payment-methods-management': () =>
        import('@/public/screens/PaymentMethodsManagement/PaymentMethodsManagement.entry.ce').then(
            (module) => module.defineSolvimonPaymentMethodsManagement,
        ),
};

const COMPONENT_LOADERS: Record<RegisteredComponentId, DefineLoader> = {
    invoice: () =>
        import('@/public/components/Invoice/Invoice.entry.ce').then(
            (module) => module.defineSolvimonInvoice,
        ),
    'invoice-header': () =>
        import('@/public/components/InvoiceHeader/InvoiceHeader.entry.ce').then(
            (module) => module.defineSolvimonInvoiceHeader,
        ),
    'invoice-details': () =>
        import('@/public/components/InvoiceDetails/InvoiceDetails.entry.ce').then(
            (module) => module.defineSolvimonInvoiceDetails,
        ),
    'invoices-list': () =>
        import('@/public/components/InvoicesList/InvoicesList.entry.ce').then(
            (module) => module.defineSolvimonInvoicesList,
        ),
    'payment-history': () =>
        import('@/public/components/PaymentHistory/PaymentHistory.entry.ce').then(
            (module) => module.defineSolvimonPaymentHistory,
        ),
    'subscriptions-list': () =>
        import('@/public/components/SubscriptionsList/SubscriptionsList.entry.ce').then(
            (module) => module.defineSolvimonSubscriptionsList,
        ),
    'subscription-schedules': () =>
        import('@/public/components/SubscriptionSchedules/SubscriptionSchedules.entry.ce').then(
            (module) => module.defineSolvimonSubscriptionSchedules,
        ),
    'customer-payment-methods': () =>
        import('@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.entry.ce').then(
            (module) => module.defineSolvimonCustomerPaymentMethods,
        ),
    'wallet-balances': () =>
        import('@/public/components/WalletBalances/WalletBalances.entry.ce').then(
            (module) => module.defineSolvimonWalletBalances,
        ),
    'billing-information': () =>
        import('@/public/components/BillingInformation/BillingInformation.entry.ce').then(
            (module) => module.defineSolvimonBillingInformation,
        ),
    'billing-information-form': () =>
        import('@/public/components/BillingInformationForm/BillingInformationForm.entry.ce').then(
            (module) => module.defineSolvimonBillingInformationForm,
        ),
    'payment-method-form': () =>
        import('@/public/components/PaymentMethodForm/PaymentMethodForm.entry.ce').then(
            (module) => module.defineSolvimonPaymentMethodForm,
        ),
};

function isRegisteredScreenId(id: string): id is RegisteredScreenId {
    return Object.hasOwn(SCREEN_LOADERS, id);
}

function isRegisteredComponentId(id: string): id is RegisteredComponentId {
    return Object.hasOwn(COMPONENT_LOADERS, id);
}

export function getCustomElementTagName(viewId: string): string {
    return getComponentName(viewId);
}

/**
 * Loads the entry for `viewId` and registers its custom element.
 *
 * An unknown id throws synchronously, as it always did — that is a caller's mistake and should
 * surface at the call site rather than inside a rejected promise.
 */
export function ensureCustomElementDefined(
    viewId: string,
    type: 'screen' | 'component',
): Promise<void> {
    const load =
        type === 'screen'
            ? isRegisteredScreenId(viewId) && SCREEN_LOADERS[viewId]
            : isRegisteredComponentId(viewId) && COMPONENT_LOADERS[viewId];

    if (!load) {
        throw new Error(
            `Solvimon: unknown ${type} id "${viewId}". Registered ${type}s: ${Object.keys(
                type === 'screen' ? SCREEN_LOADERS : COMPONENT_LOADERS,
            ).join(', ')}.`,
        );
    }

    return load().then((define) => define());
}
