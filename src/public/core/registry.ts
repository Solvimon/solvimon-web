import type { RegisteredScreenId, RegisteredComponentId } from './types';

/**
 * Keyed by id so the compiler holds the list to the ids `types.ts` declares: one missing, or one
 * that is not declared, is a type error. The loaders in `registry.ce.ts` are keyed the same way.
 */
const SCREEN_IDS: Record<RegisteredScreenId, true> = {
    'customer-overview': true,
    checkout: true,
    'checkout-session': true,
    'subscription-management': true,
    'subscription-details': true,
    'pay-invoice': true,
    'payment-methods-management': true,
};

const COMPONENT_IDS: Record<RegisteredComponentId, true> = {
    invoice: true,
    'invoice-header': true,
    'invoice-details': true,
    'invoices-list': true,
    'payment-history': true,
    'subscriptions-list': true,
    'subscription-schedules': true,
    'customer-payment-methods': true,
    'wallet-balances': true,
    'billing-information': true,
    'billing-information-form': true,
    'payment-method-form': true,
};

const isScreenId = (id: string): id is RegisteredScreenId => Object.hasOwn(SCREEN_IDS, id);

const isComponentId = (id: string): id is RegisteredComponentId => Object.hasOwn(COMPONENT_IDS, id);

export function getRegisteredScreenIds(): RegisteredScreenId[] {
    return Object.keys(SCREEN_IDS).filter(isScreenId);
}

export function getRegisteredComponentIds(): RegisteredComponentId[] {
    return Object.keys(COMPONENT_IDS).filter(isComponentId);
}
