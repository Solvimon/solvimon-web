import type { Invoice } from '@solvimon/solvimon-types';
import { isApiError } from '@/services/apiError';

export function isInvoiceSettled(invoice: Pick<Invoice, 'payment_status'>): boolean {
    return invoice.payment_status === 'PAID' || invoice.payment_status === 'OVERPAID';
}

export type ChargeError =
    | 'PAYMENT_METHOD'
    | 'PRICING_ITEMS'
    | 'SUBSCRIPTION_INACTIVE'
    | 'PAYMENT_FAILED'
    | 'FAILED';

export type FixableChargeError = Extract<
    ChargeError,
    'PAYMENT_METHOD' | 'PRICING_ITEMS' | 'SUBSCRIPTION_INACTIVE'
>;

export function getChargeError(error: unknown): ChargeError {
    if (!isApiError(error)) {
        return 'FAILED';
    }

    if (error.statusCode === 422) {
        return 'PAYMENT_FAILED';
    }

    if (error.statusCode !== 400) {
        return 'FAILED';
    }

    if (error.field === 'payment_method_id') return 'PAYMENT_METHOD';
    if (error.field === 'pricing_plan_subscription_id') return 'SUBSCRIPTION_INACTIVE';
    if (error.field === 'pricing_items' || error.field?.startsWith('pricing_items.')) {
        return 'PRICING_ITEMS';
    }
    return 'FAILED';
}

export function isFixableChargeError(error: ChargeError): error is FixableChargeError {
    return (
        error === 'PAYMENT_METHOD' || error === 'PRICING_ITEMS' || error === 'SUBSCRIPTION_INACTIVE'
    );
}
