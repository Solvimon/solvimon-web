import type { Error as SdkError } from '@/types/errors';
import { getSessionReference } from '@/utils/sessionReference';

/**
 * The rejection `createRequestService` throws on a failed call. It is a plain object rather than an
 * `Error`, so it is recognised by shape.
 */
type ApiRejection = {
    hasError?: boolean;
    statusCode?: number;
    message?: string;
    requestId?: string | null;
    field?: string;
};

export type ApiFailureDetails = {
    /** The backend's `X-Request-Id`, which is what joins this failure to its server-side logs. */
    requestId?: string;
    statusCode?: number;
    /** The message the API gave, kept apart from the SDK's own wording for the log. */
    apiMessage?: string;
};

export type PaymentGateway = 'ADYEN' | 'STRIPE';

export type PaymentFailureParams = {
    /**
     * Which failure this is, in the same vocabulary as the log code it is emitted under. Logged as
     * a field and used as the first part of the fingerprint, because the code alone would group
     * every merchant's failures into one issue.
     */
    reason: string;
    gateway: PaymentGateway;
    paymentAcceptorId?: string;
    paymentMethodType?: string;
    /** `AUTHORIZE` or `TOKENIZE` — a declined card and a rejected tokenization read alike without it. */
    variant?: string;
    invoiceId?: string;
    customerId?: string;
    /** Whatever was caught. Only its API fields are read; the value itself goes to the logger. */
    cause?: unknown;
    /** Anything else worth knowing about this particular failure. */
    extra?: Record<string, unknown>;
};

function isApiRejection(error: unknown): error is ApiRejection {
    return typeof error === 'object' && error !== null && 'hasError' in error;
}

/**
 * Lifts the fields a failed API call carries into something loggable. The request id in particular
 * was already being captured by the request service and then dropped on the floor.
 */
export function extractApiFailureDetails(error: unknown): ApiFailureDetails {
    if (!isApiRejection(error)) {
        return {};
    }

    return {
        ...(error.requestId ? { requestId: error.requestId } : {}),
        ...(typeof error.statusCode === 'number' ? { statusCode: error.statusCode } : {}),
        ...(error.message ? { apiMessage: error.message } : {}),
    };
}

/**
 * The context every failed payment attempt is logged with.
 *
 * Note what this does *not* do: it never calls the logger. The log code has to stay a string
 * literal at the call site for `npm run logs:list` to find it, so each caller keeps its own
 * `logger.error('CODE', …)` and passes this as the context.
 */
export function createPaymentFailureContext({
    reason,
    gateway,
    paymentAcceptorId,
    paymentMethodType,
    variant,
    invoiceId,
    customerId,
    cause,
    extra,
}: PaymentFailureParams): Record<string, unknown> {
    return {
        // Groups by what failed and where, so one merchant's broken acceptor stays one issue
        // instead of one issue per customer who ran into it.
        fingerprint: [reason, gateway, ...(paymentAcceptorId ? [paymentAcceptorId] : [])],
        reason,
        gateway,
        // Carried here as well as on the entry itself: a consumer that forwards only the context
        // to their reporter still ends up able to search for what the customer quoted.
        reference: getSessionReference(),
        ...(paymentAcceptorId ? { paymentAcceptorId } : {}),
        ...(paymentMethodType ? { paymentMethodType } : {}),
        ...(variant ? { variant } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(customerId ? { customerId } : {}),
        ...extractApiFailureDetails(cause),
        ...extra,
    };
}

/** The failure as the customer-facing card needs it, carrying the reference they can quote. */
export function createPaymentFailureError(error: Omit<SdkError, 'reference'>): SdkError {
    return { ...error, reference: getSessionReference() };
}
