import type { Invoice } from '@solvimon/solvimon-types';
import { isApiError } from '@/services/apiError';

/**
 * Whether nothing is left to pay on the invoice. `OVERPAID` is settled too; `UNPAID`,
 * `PARTIALLY_PAID` and a missing status are not.
 */
export function isInvoiceSettled(invoice: Pick<Invoice, 'payment_status'>): boolean {
    return invoice.payment_status === 'PAID' || invoice.payment_status === 'OVERPAID';
}

/**
 * Why a charge from `POST /portal/invoices/charge-on-demand-pricing-items` did not go through. The
 * endpoint returns no error code, so this goes by HTTP status and the field a validation error
 * names.
 */
export type ChargeError =
    /** 400 on `payment_method_id`: the method can't pay this subscription. */
    | 'PAYMENT_METHOD'
    /** 400 on `pricing_items` or one of its entries: an item, its units or its amount isn't accepted. */
    | 'ORDER_ITEMS'
    /** 400 on `pricing_plan_subscription_id`: the subscription isn't active. */
    | 'SUBSCRIPTION_INACTIVE'
    /** 422: the payment could not be made. An unpaid invoice may have been left behind. */
    | 'PAYMENT_FAILED'
    /**
     * Anything else, such as another 400, a 404, 406, 408, 5xx or no response. Several of these come
     * after the invoice was created or even charged, so whether the order went through is unknown.
     */
    | 'FAILED';

/**
 * The errors the customer can fix on the order itself. The backend refuses these before it creates
 * an invoice, so sending the order again cannot place a second one.
 */
export type OrderError = Extract<
    ChargeError,
    'PAYMENT_METHOD' | 'ORDER_ITEMS' | 'SUBSCRIPTION_INACTIVE'
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
        return 'ORDER_ITEMS';
    }
    return 'FAILED';
}

export function isOrderError(error: ChargeError): error is OrderError {
    return (
        error === 'PAYMENT_METHOD' || error === 'ORDER_ITEMS' || error === 'SUBSCRIPTION_INACTIVE'
    );
}
