import type { PaymentAcceptor } from '@solvimon/solvimon-types';

/** How many acceptors the block shows when the host does not say. */
export const DEFAULT_MAX_ITEMS = 3;

/**
 * The acceptors a subscription is paid into: the ones linked to it, or, with none linked, every
 * active acceptor of the customer, which is what its invoices offer the payer then.
 */
export const getSubscriptionPaymentAcceptors = (
    paymentAcceptors: PaymentAcceptor[],
    linkedIds: PaymentAcceptor['id'][],
): PaymentAcceptor[] =>
    linkedIds.length
        ? paymentAcceptors.filter(({ id }) => linkedIds.includes(id))
        : paymentAcceptors.filter(({ status }) => status === 'ACTIVE');
