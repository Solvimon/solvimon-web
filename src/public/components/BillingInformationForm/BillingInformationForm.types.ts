import type { Customer, FormFieldError } from '@solvimon/solvimon-types';

export interface BillingInformationFormProps {
    customer: Customer;
    apiError?: FormFieldError;
    updateCustomer: ({
        customerId,
        payload,
    }: {
        customerId: Customer['id'];
        payload: Partial<Customer>;
    }) => Promise<Customer>;
    isLoading: boolean;
}
