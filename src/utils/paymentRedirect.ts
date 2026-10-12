import { getQueryParam } from '@/utils/url';

export const PAYMENT_ACCEPTOR_ID_QUERY_STRING = 'payment_acceptor_id';
export const REDIRECT_RESULT_QUERY_STRING = 'redirectResult';

const STRIPE_REDIRECT_STATUS_QUERY_STRING = 'redirect_status';
const STRIPE_PAYMENT_INTENT_CLIENT_SECRET_QUERY_STRING = 'payment_intent_client_secret';
const STRIPE_SETUP_INTENT_CLIENT_SECRET_QUERY_STRING = 'setup_intent_client_secret';

/** Everything a gateway hands back on a redirect return; none of it means anything once handled. */
const REDIRECT_QUERY_STRINGS = [
    PAYMENT_ACCEPTOR_ID_QUERY_STRING,
    REDIRECT_RESULT_QUERY_STRING,
    STRIPE_REDIRECT_STATUS_QUERY_STRING,
    'payment_intent',
    STRIPE_PAYMENT_INTENT_CLIENT_SECRET_QUERY_STRING,
    'setup_intent',
    STRIPE_SETUP_INTENT_CLIENT_SECRET_QUERY_STRING,
];

// Adyen's redirect result is opaque, so only its shape is checked: printable, no spaces, bounded.
const ADYEN_REDIRECT_RESULT_PATTERN = /^[\x21-\x7e]{1,16384}$/;
const STRIPE_REDIRECT_STATUS_PATTERN = /^[a-z_]{1,64}$/;
const STRIPE_CLIENT_SECRET_PATTERNS = {
    PAYMENT: /^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/,
    SETUP: /^seti_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$/,
} as const;

export type AdyenRedirectReturn =
    | { kind: 'RESULT'; redirectResult: string }
    | { kind: 'MISSING_PAYMENT_ACCEPTOR' }
    | { kind: 'INVALID' };

export type StripeRedirectReturn = {
    redirectStatus: string;
    intent: 'PAYMENT' | 'SETUP';
    clientSecret: string;
};

/** Whether the page was returned to from a gateway redirect, whichever form it is for. */
export function hasPaymentRedirectReturn(): boolean {
    return (
        !!getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING) &&
        (!!getQueryParam(REDIRECT_RESULT_QUERY_STRING) ||
            !!getQueryParam(STRIPE_REDIRECT_STATUS_QUERY_STRING))
    );
}

/**
 * The Adyen redirect return meant for this payment acceptor. Another acceptor's return is left to
 * the form it belongs to, so several forms on one page never confirm the same payment.
 */
export function readAdyenRedirectReturn(
    paymentAcceptorId: string,
): AdyenRedirectReturn | undefined {
    const redirectResult = getQueryParam(REDIRECT_RESULT_QUERY_STRING);
    if (!redirectResult) return;

    const urlPaymentAcceptorId = getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING);
    if (!urlPaymentAcceptorId) return { kind: 'MISSING_PAYMENT_ACCEPTOR' };
    if (urlPaymentAcceptorId !== paymentAcceptorId) return;

    if (!ADYEN_REDIRECT_RESULT_PATTERN.test(redirectResult)) return { kind: 'INVALID' };

    return { kind: 'RESULT', redirectResult };
}

/** The Stripe redirect return meant for this payment acceptor, if it is one Stripe could send. */
export function readStripeRedirectReturn(
    paymentAcceptorId: string,
): StripeRedirectReturn | undefined {
    if (getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING) !== paymentAcceptorId) return;

    const redirectStatus = getQueryParam(STRIPE_REDIRECT_STATUS_QUERY_STRING);
    if (!redirectStatus || !STRIPE_REDIRECT_STATUS_PATTERN.test(redirectStatus)) return;

    const paymentIntentClientSecret = getQueryParam(
        STRIPE_PAYMENT_INTENT_CLIENT_SECRET_QUERY_STRING,
    );
    if (paymentIntentClientSecret) {
        if (!STRIPE_CLIENT_SECRET_PATTERNS.PAYMENT.test(paymentIntentClientSecret)) return;
        return { redirectStatus, intent: 'PAYMENT', clientSecret: paymentIntentClientSecret };
    }

    const setupIntentClientSecret = getQueryParam(STRIPE_SETUP_INTENT_CLIENT_SECRET_QUERY_STRING);
    if (setupIntentClientSecret) {
        if (!STRIPE_CLIENT_SECRET_PATTERNS.SETUP.test(setupIntentClientSecret)) return;
        return { redirectStatus, intent: 'SETUP', clientSecret: setupIntentClientSecret };
    }
}

/**
 * Takes the redirect return out of the address, so a reload or a shared link does not hand the
 * same result to the gateway a second time.
 */
export function clearPaymentRedirectParams(): void {
    const url = new URL(window.location.href);
    const present = REDIRECT_QUERY_STRINGS.filter((name) => url.searchParams.has(name));
    if (!present.length) return;

    present.forEach((name) => url.searchParams.delete(name));
    window.history.replaceState(window.history.state, '', url.toString());
}
