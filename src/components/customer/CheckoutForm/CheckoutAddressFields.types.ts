import type { ErrorObject } from '@vuelidate/core';
import type { CheckoutFormState } from './CheckoutForm.types';
import type { AddressFormat } from './addressFormat';

export type CheckoutAddressVariant = 'BILLING' | 'SHIPPING';

export interface CheckoutAddressFieldsProps {
    variant: CheckoutAddressVariant;
    withCountry?: boolean;
    /** Puts the country below the recipient, just above the address lines, rather than first. */
    countryBeforeAddress?: boolean;
    countryLabel?: string;
    format?: AddressFormat;
    getOptionalSuffix: (field: keyof CheckoutFormState) => string;
    errors?: {
        addressLine1?: ErrorObject[];
        postalCode?: ErrorObject[];
        city?: ErrorObject[];
        state?: ErrorObject[];
        country?: ErrorObject[];
        phoneNumber?: ErrorObject[];
        lastName?: ErrorObject[];
    };
}
