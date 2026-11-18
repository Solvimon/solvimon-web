import type { PaymentAcceptor, PricingPlanSubscription } from '@solvimon/solvimon-types';
import type { UsePaymentAcceptors } from '@/composables/usePaymentAcceptors';

export interface PaymentAcceptorsModalProps {
    showModal: boolean;
    /** Every acceptor of the customer; only the active ones can be chosen. */
    paymentAcceptors: PaymentAcceptor[];
    /** The subscription whose acceptors are chosen, the ids it is linked to now and who pays into them. */
    subscription: {
        id: PricingPlanSubscription['id'];
        paymentAcceptorIds: PaymentAcceptor['id'][];
        payerName?: string;
    };
    /** Stores a new acceptor and reloads the acceptors. */
    create: UsePaymentAcceptors['create'];
    /** Stores the acceptors chosen for the subscription; an empty list unlinks them all. */
    saveChoice: (paymentAcceptorIds: PaymentAcceptor['id'][]) => Promise<unknown>;
}

export interface PaymentAcceptorsModalEmits {
    (e: 'close'): void;
}
