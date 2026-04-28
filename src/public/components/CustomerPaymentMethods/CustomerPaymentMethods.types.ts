import type { PaymentMethod, PaymentMethodOption } from '@solvimon/solvimon-types';

export interface CustomerPaymentMethodsConfiguration {
    /**
     * The maximum number of payment methods to show.
     * @default 3
     */
    maxItems?: number;
    /**
     * Whether to show the view all button when there are more than maxItems payment methods.
     */
    showViewAllButton?: boolean;
    /**
     * Whether to show the add button when there are less than maxItems payment methods.
     */
    showAddButton?: boolean;
}

export interface CustomerPaymentMethodsProps {
    isLoading: boolean;
    paymentMethods: PaymentMethod[];
    paymentMethodsOptions: PaymentMethodOption[];
    maxPaymentMethods?: number;
    configuration?: CustomerPaymentMethodsConfiguration;
}
