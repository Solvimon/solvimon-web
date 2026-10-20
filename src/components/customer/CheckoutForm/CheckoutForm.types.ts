import type { ConfiguredMeterValue, CountryCode, Pricing } from '@solvimon/solvimon-types';
import type { useCheckoutForm } from './useCheckoutForm';
import type { AddressFormat } from './addressFormat';

export interface CheckoutFormProps {
    validation: ReturnType<typeof useCheckoutForm>['validation'];
    initialState?: Partial<CheckoutFormState>;
    readOnlyEmail?: string;
    showCustomerInfoOnTop?: boolean;
    isBillingInformationMandatory?: boolean;
    isShippingAddressRequired?: boolean;
    getIsFieldRequired: (field: keyof CheckoutFormState) => boolean;
    shippingAddressFormat?: AddressFormat;
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
    shippingAddressLine1: string | undefined;
    shippingAddressLine2: string | undefined;
    shippingPostalCode: string | undefined;
    shippingCity: string | undefined;
    shippingState: string | undefined;
    shippingCountry: CountryCode | undefined;
    shippingPhoneNumber: string | undefined;
    shippingFirstName: string | undefined;
    shippingLastName: string | undefined;
    shippingAttentionName: string | undefined;
    /** While true, the billing fields follow the shipping ones. */
    billingAddressSameAsShipping: boolean;
    seatsValues: ConfiguredMeterValue[] | undefined;
    unitsValues: ConfiguredMeterValue[] | undefined;
    promotionCode?: string;
    enabledPricingIds: Pricing['id'][] | undefined;
}
