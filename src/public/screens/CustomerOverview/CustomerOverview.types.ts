import type { CustomerPaymentMethodsConfiguration } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.types';

export interface CustomerOverviewConfiguration {
    /** The payment methods block, configured as the `customer-payment-methods` element is. */
    paymentMethods?: CustomerPaymentMethodsConfiguration;
}

export interface CustomerOverviewProps {
    configuration?: CustomerOverviewConfiguration;
}
