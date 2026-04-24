import type { Customer, FormFieldError } from '@solvimon/types';

export type BillingInformationFormState = {
    type: 'INDIVIDUAL' | 'ORGANIZATION';
    email: string;
    country: string;
    companyLegalName?: string;
    companyVatNumber?: string;
    firstName?: string;
    lastName?: string;
    addressLine1: string;
    addressLine2?: string;
    postalCode: string;
    city: string;
    state?: string;
};

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
