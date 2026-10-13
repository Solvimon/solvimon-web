import type { PaymentMethod } from '@solvimon/solvimon-types';

export interface CustomerPaymentMethodsBlockProps {
    paymentMethods: PaymentMethod[];
    showViewAllButton?: boolean;
    showAddButton?: boolean;
}

export interface CustomerPaymentMethodsBlockEmits {
    (e: 'view-all-payment-methods'): void;
    (e: 'add-payment-method'): void;
}
