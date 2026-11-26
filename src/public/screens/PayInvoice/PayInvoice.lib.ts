import type {
    Invoice,
    PaymentAcceptor,
    PaymentMethod,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import { formatEnum } from '@solvimon/solvimon-ui';
import { getPaymentMethodName } from '@/components/payments/PaymentMethodSelector/usePaymentMethodSelectorOptions';
import { isPayablePaymentMethod } from '@/utils/paymentMethods';
import { isCreditInvoice } from '@/utils/invoiceState';

export interface ChargeableStoredPaymentMethod {
    paymentMethod: PaymentMethod;
    /** The acceptor of this invoice whose gateway holds the stored method. */
    paymentAcceptorId: PaymentAcceptor['id'];
}

/**
 * The stored methods this invoice can be charged to: active, unexpired ones whose gateway is one of
 * the invoice's acceptors. A method stored with another gateway cannot be charged through these.
 */
export function getChargeableStoredPaymentMethods(
    paymentMethods: PaymentMethod[],
    paymentMethodOptions: PaymentMethodOptionsResponse,
    now: Date = new Date(),
): ChargeableStoredPaymentMethod[] {
    return paymentMethods.flatMap((paymentMethod) => {
        const entry = paymentMethodOptions.find(
            ({ integration }) =>
                Boolean(paymentMethod.integration_id) &&
                integration?.id === paymentMethod.integration_id,
        );

        return entry && isPayablePaymentMethod(paymentMethod, now)
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

export type InvoiceNotPayableReason = 'CREDIT' | 'NOT_ISSUED' | 'NOTHING_OPEN' | 'CLOSED';

/** Why the API would refuse a payment on an invoice that is neither paid nor payable. */
export function getInvoiceNotPayableReason(
    invoice: Pick<Invoice, 'status' | 'type'>,
): InvoiceNotPayableReason {
    if (isCreditInvoice(invoice)) return 'CREDIT';
    if (invoice.status === 'FINAL' || invoice.status === 'EMPTY') return 'NOTHING_OPEN';
    // FUTURE, an invoice for a period not started yet, is a status the types do not list.
    return ['DRAFT', 'OPEN', 'FUTURE'].includes(invoice.status) ? 'NOT_ISSUED' : 'CLOSED';
}
