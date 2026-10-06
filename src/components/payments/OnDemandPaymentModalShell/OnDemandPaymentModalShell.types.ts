import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';

export interface OnDemandPaymentModalShellProps {
    showModal: boolean;
    title: string;
    subTitle?: string;
    cancelButtonText: string;
    confirmButtonText: string;
    isPending: boolean;
    /** Every pane the modal steps between, in order. */
    panes: readonly string[];
    step: string;
    /** Which of the panes holds the add-payment-method detour, which the shell renders itself. */
    addPaymentMethodPane: string;
    customer?: Customer;
    paymentMethodOptions?: PaymentMethodOptionsResponse;
    isPaymentMethodOptionsPending?: boolean;
    isAddingPaymentMethod?: boolean;
}

export interface OnDemandPaymentModalShellEmits {
    (e: 'confirm'): void;
    (e: 'cancel'): void;
    (e: 'payment-success'): void;
    (e: 'payment-failed', error: unknown): void;
}
