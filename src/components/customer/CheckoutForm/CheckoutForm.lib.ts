import type { CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from './CheckoutForm.types';

const DEFAULT_REQUIRED_FIELDS: (keyof CheckoutFormState)[] = ['email', 'country'];

/**
 * Map of country codes to the required fields for that country.
 * This only contains country codes that have specific required fields.
 */
export const countrySpecificRequiredFieldsMap: Partial<
    Record<CountryCode, (keyof CheckoutFormState)[]>
> = {
    US: ['addressLine1', 'postalCode'],
    CA: ['state'],
};

/**
 * Get the required fields for a country, will always default to the email and country fields,
 * which are always mandatory.
 */
export const getRequiredFieldsForCountry = (
    country: CountryCode | undefined,
): (keyof CheckoutFormState)[] => {
    if (!country || !countrySpecificRequiredFieldsMap[country]) {
        return DEFAULT_REQUIRED_FIELDS;
    }

    return [...countrySpecificRequiredFieldsMap[country], ...DEFAULT_REQUIRED_FIELDS];
};
