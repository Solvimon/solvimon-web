import type { Customer, PaymentMethodOptionsResponse } from '@solvimon/solvimon-types';

export interface AddPaymentMethodModalProps {
    showModal: boolean;
    /** The customer the method is stored against. The form needs their country, name and email. */
    customer?: Customer;
    paymentMethodOptions: PaymentMethodOptionsResponse;
    isLoading?: boolean;
}

export interface AddPaymentMethodModalEmits {
    /** A payment method was tokenized and stored. */
    (e: 'success'): void;
    (e: 'failure', error: unknown): void;
    (e: 'close'): void;
}
