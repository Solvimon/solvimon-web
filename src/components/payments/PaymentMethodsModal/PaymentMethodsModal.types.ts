import type { Customer, PaymentMethod } from '@solvimon/solvimon-types';

export const PAYMENT_METHODS_MODAL_STEPS = ['LIST', 'ADD_PAYMENT_METHOD'] as const;

export type PaymentMethodsModalStep = (typeof PAYMENT_METHODS_MODAL_STEPS)[number];

export interface PaymentMethodsModalProps {
    showModal: boolean;
    /**
     * Where the modal opens. Opened on adding a method, it closes once one is stored rather than
     * going on to the list.
     * @default 'LIST'
     */
    start?: PaymentMethodsModalStep;
    customer?: Customer;
    paymentMethods: PaymentMethod[];
}

export interface PaymentMethodsModalEmits {
    (e: 'close'): void;
    /** A method was stored, made the default or deleted: the methods shown elsewhere are stale. */
    (e: 'changed'): void;
    (e: 'payment-failed', error: unknown): void;
}
