import type { ErrorObject } from '@vuelidate/core';
import type { CheckoutFormState } from './CheckoutForm.types';

/** Which of the two addresses the fields stand for, and so which state they are bound to. */
export type CheckoutAddressVariant = 'BILLING' | 'SHIPPING';

export interface CheckoutAddressFieldsProps {
    variant: CheckoutAddressVariant;
    /** Shown above the first line, naming the address — "Shipping address". */
    label?: string;
    /** Whether the fields carry a country of their own, below the rest of the address. */
    withCountry?: boolean;
    /** Names that country — "Shipping country". Falls back to the shared billing country label. */
    countryLabel?: string;
    /** Appends "(optional)" to the fields this address does not insist on. */
    getOptionalSuffix: (field: keyof CheckoutFormState) => string;
    /** What each field failed validation on, as vuelidate reports it. */
    errors?: {
        addressLine1?: ErrorObject[];
        postalCode?: ErrorObject[];
        city?: ErrorObject[];
        state?: ErrorObject[];
        country?: ErrorObject[];
    };
}
