import type { CustomerPaymentMethodsConfiguration } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.types';
import type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export interface CustomerOverviewConfiguration {
    /** The payment methods block, configured as the `customer-payment-methods` element is. */
    paymentMethods?: CustomerPaymentMethodsConfiguration;
    /** Options for the self-billing block. Set to false to hide it and skip its requests. */
    paymentAcceptors?: false | PaymentAcceptorsConfiguration;
}

export interface CustomerOverviewProps {
    configuration?: CustomerOverviewConfiguration;
}
