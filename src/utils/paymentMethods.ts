import type { RawPaymentMethod } from '@adyen/adyen-web';
import type { PaymentMethod } from '@solvimon/solvimon-types';

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

/**
 * A card can be charged through the last day of its expiry month, in UTC. The API keeps an expired
 * card `ACTIVE` and has no filter for it yet (MD-5862), so a screen that charges one leaves it out.
 */
export function isExpiredCard(paymentMethod: PaymentMethod, now: Date = new Date()): boolean {
    if (paymentMethod.type !== 'CARD' || !paymentMethod.card?.expiry_date) return false;

    const { expiry_month: month, expiry_year: year } = paymentMethod.card.expiry_date;

    return now.getTime() >= Date.UTC(year, month, 1);
}
