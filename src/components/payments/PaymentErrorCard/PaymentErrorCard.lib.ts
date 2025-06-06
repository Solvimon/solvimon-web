import type { Error } from '@/types/errors';

export const ErrorMap: Record<
    Error['code'],
    {
        title: string;
        message: string;
        isReloadButtonVisible?: boolean;
    }
> = {
    UNKNOWN_ERROR: {
        title: 'Something went wrong',
        message: 'An unknown error has occurred',
        isReloadButtonVisible: true,
    },
    AUTHORIZATION_FAILED: {
        title: 'Payment failed',
        message: 'The payment failed',
    },
    PAYMENT_DETAILS_CALL_FAILED: {
        title: 'Payment details call failed',
        message: 'There was a problem getting the payment details',
    },
    PAYMENT_METHOD_STORAGE_FAILED: {
        title: 'Failed storing payment method',
        message: 'Something went wrong with storing the payment method',
    },
    REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING: {
        title: 'Missing payment acceptor',
        message: 'A redirect result is set, but a payment acceptor is missing in the url',
    },
    TOKENIZE_FAILED: {
        title: 'Tokenization failed',
        message: 'The tokenization of the payment method has failed',
    },
    PAYMENT_INTEGRATION_INITIALIZATION_FAILED: {
        title: 'Failed loading payment methods',
        message: 'Failed loading payment integration',
        isReloadButtonVisible: true,
    },
};
