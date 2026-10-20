import type { ErrorObject } from '@vuelidate/core';
import type { CheckoutFormState } from './CheckoutForm.types';
import type { AddressFormat } from './addressFormat';

/** Which of the two addresses the fields stand for, and so which state they are bound to. */
export type CheckoutAddressVariant = 'BILLING' | 'SHIPPING';

export interface CheckoutAddressFieldsProps {
    variant: CheckoutAddressVariant;
    /** Whether the fields carry a country of their own, below the rest of the address. */
    withCountry?: boolean;
    /** Names that country — "Shipping country". Falls back to the shared billing country label. */
    countryLabel?: string;
    /**
     * How the destination country writes an address. A shipping address shows only the fields it
     * uses; until it has loaded, and for a billing address, every field shows.
     */
    format?: AddressFormat;
    /** Appends "(optional)" to the fields this address does not insist on. */
    getOptionalSuffix: (field: keyof CheckoutFormState) => string;
    /** What each field failed validation on, as vuelidate reports it. */
    errors?: {
        addressLine1?: ErrorObject[];
        postalCode?: ErrorObject[];
        city?: ErrorObject[];
        state?: ErrorObject[];
        country?: ErrorObject[];
        /** The recipient's phone number, which only the shipping variant asks for. */
        phoneNumber?: ErrorObject[];
        lastName?: ErrorObject[];
    };
}
