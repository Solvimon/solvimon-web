import type { Customer } from '@solvimon/solvimon-types';

export interface BillingInformationConfiguration {
    showEditButton?: boolean;
}

export interface BillingInformationProps {
    customer: Customer;
    isLoading: boolean;
    configuration?: BillingInformationConfiguration;
}

export interface BillingInformationEmits {
    (e: 'edit-billing-information'): void;
}
