import type { useCheckoutForm } from './useCheckoutForm';

export interface CheckoutFormProps {
    validation: ReturnType<typeof useCheckoutForm>['validation'];
    initialState?: Partial<CheckoutFormState>;
    readOnlyCountry?: string;
    readOnlyEmail?: string;
    isBillingInformationMandatory?: boolean;
    getIsFieldRequired: (field: keyof CheckoutFormState) => boolean;
}

export interface CheckoutFormEmits {
    (e: 'submit', state: CheckoutFormState): void;
}

export interface CheckoutFormState {
    email: string | undefined;
    country: string | undefined;
    type: 'INDIVIDUAL' | 'ORGANIZATION';
    companyLegalName: string | undefined;
    firstName: string | undefined;
    infix: string | undefined;
    lastName: string | undefined;
    addressLine1: string | undefined;
    addressLine2: string | undefined;
    postalCode: string | undefined;
    city: string | undefined;
    state: string | undefined;
    companyVatNumber: string | undefined;
}
