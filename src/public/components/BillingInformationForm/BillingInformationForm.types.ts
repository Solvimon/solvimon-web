import type { Customer, FormFieldError } from '@solvimon/types';

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
