import type { PaymentAcceptor, PricingPlanSubscription } from '@solvimon/solvimon-types';
import type { UsePaymentAcceptors } from '@/composables/usePaymentAcceptors';

/**
 * Where the modal opens. Opened on adding, editing or deleting one acceptor, it closes once that is
 * done rather than going on to the list.
 */
export type PaymentAcceptorsModalStart =
    | { step: 'LIST' | 'ADD' | 'CHOOSE' }
    | { step: 'EDIT' | 'DELETE'; paymentAcceptor: PaymentAcceptor };

export interface PaymentAcceptorsModalProps {
    showModal: boolean;
    paymentAcceptors: PaymentAcceptor[];
    isLoading?: boolean;
    /** @default { step: 'LIST' } */
    start?: PaymentAcceptorsModalStart;
    /** What the modal changes the acceptors with; each reloads them once it is done. */
    actions: Pick<UsePaymentAcceptors, 'create' | 'update' | 'remove'>;
    /**
     * The subscription whose acceptors the CHOOSE step picks, with the ids it is linked to now and
     * who pays into them. Without one there is nothing to choose for.
     */
    subscription?: {
        id: PricingPlanSubscription['id'];
        paymentAcceptorIds: PaymentAcceptor['id'][];
        payerName?: string;
    };
    /** Stores the acceptors chosen for the subscription; an empty list unlinks them all. */
    saveChoice?: (paymentAcceptorIds: PaymentAcceptor['id'][]) => Promise<unknown>;
}

export interface PaymentAcceptorsModalEmits {
    (e: 'close'): void;
}
