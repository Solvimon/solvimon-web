import type { PaymentAcceptor } from '@solvimon/solvimon-types';
import type { UsePaymentAcceptors } from '@/composables/usePaymentAcceptors';

export const PAYMENT_ACCEPTORS_MANAGE_MODAL_STEPS = ['LIST', 'ADD', 'EDIT', 'DELETE'] as const;

export type PaymentAcceptorsManageModalStep = (typeof PAYMENT_ACCEPTORS_MANAGE_MODAL_STEPS)[number];

export interface PaymentAcceptorsManageModalProps {
    showModal: boolean;
    /**
     * Where the modal opens. Opened on adding one, it closes once it is stored rather than going
     * on to the list.
     * @default 'LIST'
     */
    start?: Extract<PaymentAcceptorsManageModalStep, 'LIST' | 'ADD'>;
    /** Every acceptor of the customer. */
    paymentAcceptors: PaymentAcceptor[];
    actions: Pick<UsePaymentAcceptors, 'create' | 'update' | 'remove'>;
}

export interface PaymentAcceptorsManageModalEmits {
    (e: 'close'): void;
}
