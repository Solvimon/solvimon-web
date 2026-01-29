import type { PaymentMethodOption, PaymentMethodOptionsResponse } from '@solvimon/types';
import type { RawPaymentMethod } from '@adyen/adyen-web';

const EXPRESS_PAYMENT_METHOD_NAMES = ['Apple Pay'] as const;
const EXPRESS_PAYMENT_METHOD_TYPES = ['applepay'] as const;

/**
 * Get the express payment method options from the payment methods options response.
 */
export function getExpressPaymentMethodOptions(
    paymentMethodsOptionsResponse: PaymentMethodOptionsResponse,
): PaymentMethodOption[] {
    return paymentMethodsOptionsResponse.flatMap(
        (entry) =>
            entry.options?.filter((option) =>
                EXPRESS_PAYMENT_METHOD_NAMES.some(
                    (name) => name.toLowerCase() === option.name.toLowerCase(),
                ),
            ) ?? [],
    );
}

/**
 * Get the payment methods options response without express payment method options.
 */
export function getPaymentMethodOptionsWithoutExpress(
    paymentMethodsOptionsResponse: PaymentMethodOptionsResponse,
): PaymentMethodOptionsResponse {
    const result: PaymentMethodOptionsResponse = [];

    for (const entry of paymentMethodsOptionsResponse) {
        const filteredOptions = (entry.options ?? []).filter(
            (option) =>
                !EXPRESS_PAYMENT_METHOD_NAMES.some(
                    (name) => name.toLowerCase() === option.name.toLowerCase(),
                ),
        );

        if (filteredOptions.length === 0) {
            continue;
        }

        result.push({
            ...entry,
            options: filteredOptions,
        });
    }

    return result;
}

/**
 * Filters out express payment methods (Apple Pay, Google Pay, PayPal) from an array of RawPaymentMethod.
 */
export function filterOutExpressPaymentMethods(
    paymentMethods: RawPaymentMethod[],
): RawPaymentMethod[] {
    return paymentMethods.filter(
        (method) =>
            !EXPRESS_PAYMENT_METHOD_TYPES.some((type) => type === method.type?.toLowerCase()),
    );
}
