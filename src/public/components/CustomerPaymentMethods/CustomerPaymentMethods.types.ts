import type { PaymentMethod, PaymentMethodOption } from '@solvimon/types';

export interface CustomerPaymentMethodsConfiguration {
    showViewAllButton?: boolean;
    showAddButton?: boolean;
}

export interface CustomerPaymentMethodsProps {
    isLoading: boolean;
    paymentMethods: PaymentMethod[];
    paymentMethodsOptions: PaymentMethodOption[];
    maxPaymentMethods?: number;
    configuration?: CustomerPaymentMethodsConfiguration;
}
