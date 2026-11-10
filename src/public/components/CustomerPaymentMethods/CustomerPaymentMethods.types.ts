import type { PaymentMethod } from '@solvimon/solvimon-types';

export interface CustomerPaymentMethodsConfiguration {
    /**
     * The maximum number of payment methods to show.
     * @default 3
     */
    maxItems?: number;
    /**
     * Whether to show the "View all" button when the customer has more payment methods than
     * `maxItems`, which sends a `view-all-payment-methods` action request.
     * @default true
     */
    showViewAllButton?: boolean;
    /**
     * Whether to show the button that adds a payment method, which sends an `add-payment-method`
     * action request.
     * @default true
     */
    showAddButton?: boolean;
}

export interface CustomerPaymentMethodsProps {
    isLoading: boolean;
    paymentMethods: PaymentMethod[];
    configuration?: CustomerPaymentMethodsConfiguration;
}
