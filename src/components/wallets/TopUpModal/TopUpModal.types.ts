import type { Customer, CustomerWalletBalanceItem, PaymentMethod } from '@solvimon/solvimon-types';

/**
 * The panes the modal moves between, in the order they sit on the track. Named rather than derived
 * from booleans: every one of them changes the title, the subtitle and the footer buttons too.
 */
export type TopUpModalStep = 'TOP_UP' | 'ADD_PAYMENT_METHOD' | 'SUCCESS';

/** The order the panes are laid out in, which is also the order they are stepped through. */
export const TOP_UP_MODAL_STEPS: TopUpModalStep[] = ['TOP_UP', 'ADD_PAYMENT_METHOD', 'SUCCESS'];

export interface TopUpModalProps {
    showModal: boolean;
    selectedBalanceItem?: CustomerWalletBalanceItem;
    /** The customer's stored payment methods, to pay the top-up with. */
    paymentMethods?: PaymentMethod[];
    /** The customer being charged; the payment form needs their country, name and email. */
    customer?: Customer;
}

export interface TopUpModalEmits {
    (e: 'confirm'): void;
    (e: 'close'): void;
    /** A new payment method was tokenized and stored for the customer. */
    (e: 'payment-success'): void;
    (e: 'payment-failed', error: unknown): void;
}
