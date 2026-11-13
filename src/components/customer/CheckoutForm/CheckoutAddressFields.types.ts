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
    /** The form's own errors, or a message from the API. */
    errors?: Partial<
        Record<
            | 'addressLine1'
            | 'postalCode'
            | 'city'
            | 'state'
            | 'country'
            | 'phoneNumber'
            | 'lastName',
            ErrorObject[] | string
        >
    >;
}
