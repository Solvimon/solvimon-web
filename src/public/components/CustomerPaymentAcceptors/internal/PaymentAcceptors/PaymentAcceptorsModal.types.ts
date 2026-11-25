import type { PaymentAcceptor, PricingPlanSubscription } from '@solvimon/solvimon-types';
import type { UsePaymentAcceptors } from '@/composables/usePaymentAcceptors';
import type { PaymentAcceptorAssignment } from '@/public/types/paymentAcceptors';

export interface PaymentAcceptorsModalProps {
    showModal: boolean;
    /** Every acceptor of the customer; only the active ones can be chosen. */
    paymentAcceptors: PaymentAcceptor[];
    /** The current assignment and the billing entity that pays into the acceptors. */
    subscription: {
        id: PricingPlanSubscription['id'];
        assignment: PaymentAcceptorAssignment;
        payerName?: string;
    };
    /** Stores a new acceptor and adds it to the choices. */
    create: UsePaymentAcceptors['create'];
    saveChoice: (assignment: PaymentAcceptorAssignment) => Promise<void>;
}

export interface PaymentAcceptorsModalEmits {
    (e: 'close'): void;
}
