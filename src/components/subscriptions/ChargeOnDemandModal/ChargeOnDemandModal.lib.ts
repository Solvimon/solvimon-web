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
 * What a failed charge means for the customer, read from the response of
 * `POST /portal/invoices/charge-on-demand-pricing-items`. The endpoint returns no error code, so
 * this goes by HTTP status and the field a validation error names (see MD-5539, point 10).
 *
 * The first three are refused before an invoice is created, so the order can be tried again. The
 * rest may have left an invoice behind, or a payment in flight, so trying again could place a
 * second order or charge twice.
 */
export type ChargeFailure =
    /** 400 on `payment_method_id`: the method can't pay this subscription. */
    | 'PAYMENT_METHOD'
    /** 400 on `pricing_plan_subscription_id`: the subscription isn't active. */
    | 'SUBSCRIPTION_INACTIVE'
    /** Any other 400 or 404: the request was wrong, which is a bug on our side. */
    | 'INVALID'
    /** 422: the payment failed after the invoice was created, or the customer can't be invoiced. */
    | 'NOT_COMPLETED'
    /** 406: the invoice is locked by a payment already in progress. */
    | 'IN_PROGRESS'
    /** 408, 5xx or no response: whether the order went through is unknown. */
    | 'UNCONFIRMED';

export function getChargeFailure(error: unknown): ChargeFailure {
    if (!isApiError(error)) {
        return 'UNCONFIRMED';
    }

    switch (error.statusCode) {
        case 400:
            if (error.field === 'payment_method_id') return 'PAYMENT_METHOD';
            if (error.field === 'pricing_plan_subscription_id') return 'SUBSCRIPTION_INACTIVE';
            return 'INVALID';
        case 404:
            return 'INVALID';
        case 406:
            return 'IN_PROGRESS';
        case 422:
            return 'NOT_COMPLETED';
        default:
            return 'UNCONFIRMED';
    }
}

/** Whether the customer can stay on the order and try again. */
export function canRetryCharge(failure: ChargeFailure): boolean {
    return failure === 'PAYMENT_METHOD' || failure === 'INVALID';
}
