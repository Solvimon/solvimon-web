import type {
    PaymentAcceptor,
    PaymentMethodOption,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
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

/**
 * The options a given invoice can actually be paid with.
 *
 * Payment method options are looked up for a customer, so they carry every acceptor that customer
 * can pay through. An invoice may only accept some of those, and authorizing against one it does
 * not accept fails with a 400 the customer can do nothing about (DD-3533) — so the ones it will
 * not take are never offered.
 *
 * An invoice that names no acceptors at all restricts nothing, and is offered everything.
 */
export function getPaymentMethodOptionsForAcceptors(
    paymentMethodsOptionsResponse: PaymentMethodOptionsResponse,
    paymentAcceptorIds: PaymentAcceptor['id'][] | undefined,
): PaymentMethodOptionsResponse {
    if (!paymentAcceptorIds?.length) {
        return paymentMethodsOptionsResponse;
    }

    return paymentMethodsOptionsResponse.filter(({ payment_acceptor: paymentAcceptor }) =>
        paymentAcceptorIds.includes(paymentAcceptor?.id),
    );
}
