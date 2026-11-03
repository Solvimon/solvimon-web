import type {
    PaymentAcceptor,
    PaymentMethod,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import { formatEnum } from '@solvimon/solvimon-ui';
import { getPaymentMethodName } from '@/components/payments/PaymentMethodSelector/usePaymentMethodSelectorOptions';

export interface ChargeableStoredPaymentMethod {
    paymentMethod: PaymentMethod;
    /** The acceptor of this invoice whose gateway holds the stored method. */
    paymentAcceptorId: PaymentAcceptor['id'];
}

/**
 * The stored methods this invoice can be charged to: active ones whose gateway is one of the
 * invoice's acceptors. A method stored with another gateway cannot be charged through these.
 */
export function getChargeableStoredPaymentMethods(
    paymentMethods: PaymentMethod[],
    paymentMethodOptions: PaymentMethodOptionsResponse,
): ChargeableStoredPaymentMethod[] {
    return paymentMethods.flatMap((paymentMethod) => {
        const entry = paymentMethodOptions.find(
            ({ integration }) =>
                Boolean(paymentMethod.integration_id) &&
                integration?.id === paymentMethod.integration_id,
        );

        return paymentMethod.status === 'ACTIVE' && entry
            ? [{ paymentMethod, paymentAcceptorId: entry.payment_acceptor.id }]
            : [];
    });
}

/** The default method, or else the first one listed, so paying is a single click. */
export function getPreselectedPaymentMethodId(
    paymentMethods: PaymentMethod[],
): PaymentMethod['id'] | undefined {
    return (paymentMethods.find(({ is_default }) => is_default) ?? paymentMethods[0])?.id;
}

/** "Visa •••• 4242" for a card; the method's own name for anything else. */
export function getStoredPaymentMethodLabel(paymentMethod: PaymentMethod): string {
    if (paymentMethod.type === 'CARD' && paymentMethod.card.last_four_digits) {
        const brand = paymentMethod.card.brand ? formatEnum(paymentMethod.card.brand) : undefined;

        return [brand, `•••• ${paymentMethod.card.last_four_digits}`].filter(Boolean).join(' ');
    }

    return getPaymentMethodName(paymentMethod);
}
