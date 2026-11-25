import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import type { PaymentAcceptorAssignment } from '@/public/types/paymentAcceptors';

/** How many acceptors the block shows when the host does not say. */
export const DEFAULT_MAX_ITEMS = 3;

export function toPaymentAcceptorAssignment(ids: readonly string[]): PaymentAcceptorAssignment {
    const [first, ...rest] = ids;
    return first === undefined
        ? { mode: 'all-active' }
        : { mode: 'selected', paymentAcceptorIds: [first, ...rest] };
}

/**
 * The acceptors a subscription is paid into: the ones linked to it, or, with none linked, every
 * active acceptor of the customer, which is what its invoices offer the payer then.
 */
export const getSubscriptionPaymentAcceptors = (
    paymentAcceptors: PaymentAcceptor[],
    assignment: PaymentAcceptorAssignment,
): PaymentAcceptor[] =>
    assignment.mode === 'selected'
        ? paymentAcceptors.filter(({ id }) => assignment.paymentAcceptorIds.includes(id))
        : paymentAcceptors;
