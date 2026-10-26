import type { CustomerPaymentMethodsConfiguration } from '@/public/components/CustomerPaymentMethods/CustomerPaymentMethods.types';

export interface CustomerOverviewConfiguration extends CustomerPaymentMethodsConfiguration {
    /**
     * Whether to show the customer's shipping addresses, for merchants that ship physical goods.
     * @default false
     */
    showShippingAddresses?: boolean;
}

export interface CustomerOverviewProps {
    configuration?: CustomerOverviewConfiguration;
}
