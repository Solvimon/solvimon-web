import type { AuthorizePaymentResponse, PaymentDetailsResponse } from '@solvimon/solvimon-types';
import { isApiError } from '@/services/apiError';

/**
 * `UNCONFIRMED` is an outcome the customer must not act on yet: the payment may still go through,
 * so offering a retry risks charging them twice.
 */
export type PaymentOutcome = 'SUCCEEDED' | 'UNCONFIRMED' | 'FAILED';

/** For a response that is final; `ACTION_REQUIRED` is the caller's to handle first. */
export function getAuthorizeOutcome(response: AuthorizePaymentResponse): PaymentOutcome {
    if (response.status !== 'SUCCESS') return 'FAILED';

    // A tokenization answers without a payment.
    const result = response.payment?.result;
    if (result === undefined || result === 'AUTHORIZED') return 'SUCCEEDED';
    if (result === 'PENDING') return 'UNCONFIRMED';
    return 'FAILED';
}

export function getPaymentDetailsOutcome(response: PaymentDetailsResponse): PaymentOutcome {
    if (response.payment_status === 'SUCCESS') return 'SUCCEEDED';
    if (response.payment_status === 'FAILURE' || response.payment_status === 'REFUSED') {
        return 'FAILED';
    }
    // ACTION_REQUIRED arrives without an action to take, so all that is left is to wait.
    return 'UNCONFIRMED';
}

export function getStripeIntentOutcome(status: string | undefined): PaymentOutcome {
    if (status === 'succeeded' || status === 'requires_capture') return 'SUCCEEDED';
    if (status === 'processing' || status === undefined) return 'UNCONFIRMED';
    return 'FAILED';
}

/**
 * Whether a payment call that threw may still have been carried out. Only a 4xx says the API
 * turned the request down; a network failure, a timeout, a 5xx or an unreadable success body leave
 * the charge unknown.
 */
export function isOutcomeUnknownAfterError(error: unknown): boolean {
    if (!isApiError(error)) return true;
    return error.statusCode < 400 || error.statusCode >= 500 || error.statusCode === 408;
}
