import type { Customer } from '@solvimon/solvimon-types';

export interface BillingInformationConfiguration {
    /**
     * Whether to show the button that edits the billing information, which sends an
     * `edit-billing-information` action request.
     * @default true
     */
    showEditButton?: boolean;
}

export interface BillingInformationProps {
    customer?: Customer;
    isLoading: boolean;
    configuration?: BillingInformationConfiguration;
}
