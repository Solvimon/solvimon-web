import type { useIntl } from '@solvimon/solvimon-ui';
import type { Error } from '@/types/errors';

type Translate = ReturnType<typeof useIntl>['$t'];

export type PaymentErrorContent = {
    title: string;
    message: string;
    isReloadButtonVisible?: boolean;
};

/**
 * What the customer is told for each failure.
 *
 * Built per call rather than held as a constant because every line goes through `$t`: a module-level
 * map would be baked in the SDK's own language and shown untranslated inside a localised checkout.
 *
 * The reload button appears wherever starting over could plausibly work — a declined card the
 * customer can replace, a form that failed to load. It is left off where the fault is in the
 * integration, since reloading only shows the same message again.
 */
export function createErrorMap($t: Translate): Record<Error['code'], PaymentErrorContent> {
    return {
        UNKNOWN_ERROR: {
            title: $t({
                defaultMessage: 'Something went wrong',
                description:
                    'Title of the error card shown when a payment failed for no known reason',
                id: 'payments.error_card.unknown_error.title',
            }),
            message: $t({
                defaultMessage: 'An unknown error has occurred',
                description:
                    'Message of the error card shown when a payment failed for no known reason',
                id: 'payments.error_card.unknown_error.message',
            }),
            isReloadButtonVisible: true,
        },
        AUTHORIZATION_FAILED: {
            title: $t({
                defaultMessage: 'Payment failed',
                description: 'Title of the error card shown when a payment was not authorized',
                id: 'payments.error_card.authorization_failed.title',
            }),
            message: $t({
                defaultMessage:
                    'The payment could not be completed. Try again, or use a different payment method.',
                description: 'Message of the error card shown when a payment was not authorized',
                id: 'payments.error_card.authorization_failed.message',
            }),
            isReloadButtonVisible: true,
        },
        PAYMENT_DETAILS_CALL_FAILED: {
            title: $t({
                defaultMessage: 'Payment could not be confirmed',
                description:
                    'Title of the error card shown when the payment details could not be retrieved',
                id: 'payments.error_card.payment_details_call_failed.title',
            }),
            message: $t({
                defaultMessage: 'There was a problem confirming your payment.',
                description:
                    'Message of the error card shown when the payment details could not be retrieved',
                id: 'payments.error_card.payment_details_call_failed.message',
            }),
            isReloadButtonVisible: true,
        },
        PAYMENT_METHOD_STORAGE_FAILED: {
            title: $t({
                defaultMessage: 'Payment method could not be saved',
                description: 'Title of the error card shown when storing a payment method failed',
                id: 'payments.error_card.payment_method_storage_failed.title',
            }),
            message: $t({
                defaultMessage: 'Something went wrong while saving your payment method.',
                description: 'Message of the error card shown when storing a payment method failed',
                id: 'payments.error_card.payment_method_storage_failed.message',
            }),
            isReloadButtonVisible: true,
        },
        REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING: {
            title: $t({
                defaultMessage: 'Payment could not be completed',
                description:
                    'Title of the error card shown when a redirect returned without a payment acceptor',
                id: 'payments.error_card.redirect_result_payment_acceptor_missing.title',
            }),
            message: $t({
                defaultMessage: 'Your payment could not be matched to this order.',
                description:
                    'Message of the error card shown when a redirect returned without a payment acceptor',
                id: 'payments.error_card.redirect_result_payment_acceptor_missing.message',
            }),
        },
        TOKENIZE_FAILED: {
            title: $t({
                defaultMessage: 'Payment method could not be saved',
                description: 'Title of the error card shown when tokenization failed',
                id: 'payments.error_card.tokenize_failed.title',
            }),
            message: $t({
                defaultMessage:
                    'Your payment method could not be saved. Try again, or use a different one.',
                description: 'Message of the error card shown when tokenization failed',
                id: 'payments.error_card.tokenize_failed.message',
            }),
            isReloadButtonVisible: true,
        },
        PAYMENT_INTEGRATION_INITIALIZATION_FAILED: {
            title: $t({
                defaultMessage: 'Payment methods could not be loaded',
                description: 'Title of the error card shown when the payment form failed to load',
                id: 'payments.error_card.payment_integration_initialization_failed.title',
            }),
            message: $t({
                defaultMessage: 'The payment form could not be loaded.',
                description: 'Message of the error card shown when the payment form failed to load',
                id: 'payments.error_card.payment_integration_initialization_failed.message',
            }),
            isReloadButtonVisible: true,
        },
        RESOURCE_REVOKED: {
            title: $t({
                defaultMessage: 'This page is no longer available',
                description: 'Title of the error card shown when the portal resource was revoked',
                id: 'payments.error_card.resource_revoked.title',
            }),
            message: $t({
                defaultMessage: 'The link you followed has expired or was withdrawn.',
                description: 'Message of the error card shown when the portal resource was revoked',
                id: 'payments.error_card.resource_revoked.message',
            }),
            isReloadButtonVisible: true,
        },
    };
}
