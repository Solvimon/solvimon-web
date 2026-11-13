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
    /**
     * Hides the form's own save button, for a host that saves it from its own chrome, such as a
     * modal footer. Pair it with the exposed `submit()`.
     */
    hideSubmitButton?: boolean;
}

export interface BillingInformationFormEmits {
    /** The changes were stored. */
    (e: 'saved'): void;
}
