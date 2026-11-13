import type { Customer, FormFieldError } from '@solvimon/solvimon-types';

export interface BillingInformationFormProps {
    customer?: Customer;
    isLoading: boolean;
    apiError?: FormFieldError;
    updateCustomer: ({
        customerId,
        payload,
    }: {
        customerId: Customer['id'];
        payload: Partial<Customer>;
    }) => Promise<Customer>;
}
