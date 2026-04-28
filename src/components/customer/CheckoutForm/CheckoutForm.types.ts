import type { ConfiguredMeterValue, CountryCode, Pricing } from '@solvimon/solvimon-types';
import type { useCheckoutForm } from './useCheckoutForm';

export interface CheckoutFormProps {
    validation: ReturnType<typeof useCheckoutForm>['validation'];
    initialState?: Partial<CheckoutFormState>;
    readOnlyEmail?: string;
    showCustomerInfoOnTop?: boolean;
    isBillingInformationMandatory?: boolean;
    getIsFieldRequired: (field: keyof CheckoutFormState) => boolean;
    readOnly?: boolean;
}

export interface CheckoutFormEmits {
    (e: 'submit', state: CheckoutFormState): void;
}

export interface CheckoutFormState {
    email: string | undefined;
    country: CountryCode | undefined;
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
    seatsValues: ConfiguredMeterValue[] | undefined;
    promotionCode?: string;
    enabledPricingIds: Pricing['id'][] | undefined;
}
