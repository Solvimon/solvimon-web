import type { PaymentMethod } from '@solvimon/types';

export interface CustomerPaymentMethodsBlockProps {
    paymentMethods: PaymentMethod[];
    limit?: number;
    isLoading: boolean;
    showViewAllButton?: boolean;
    showAddButton?: boolean;
}

export interface CustomerPaymentMethodsBlockEmits {
    (e: 'view-all-payment-methods'): void;
    (e: 'add-payment-method'): void;
}
