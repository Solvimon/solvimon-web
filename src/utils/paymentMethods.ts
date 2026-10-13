import type { RawPaymentMethod } from '@adyen/adyen-web';

const EXPRESS_PAYMENT_METHOD_TYPES = ['applepay'] as const;

/**
 * Filters out express payment methods (Apple Pay) from an array of RawPaymentMethod.
 */
export function filterOutExpressPaymentMethods(
    paymentMethods: RawPaymentMethod[],
): RawPaymentMethod[] {
    return paymentMethods.filter(
        (method) =>
            !EXPRESS_PAYMENT_METHOD_TYPES.some((type) => type === method.type?.toLowerCase()),
    );
}
