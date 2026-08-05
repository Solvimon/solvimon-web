import type { Address, CountryCode, Customer } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from './CheckoutForm.types';

const DEFAULT_REQUIRED_FIELDS: (keyof CheckoutFormState)[] = ['email', 'country'];

export const DEFAULT_TAX_IDENTIFIER_TYPE = 'GENERIC_TAX_ID';

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

/**
 * Map the checkout form state onto the customer it describes, so consumers that work with
 * customers (the invoice preview for instance) do not have to know about this form.
 */
export const toCustomer = (state: Partial<CheckoutFormState>): Partial<Customer> => {
    const address: Address = {
        ...(state.addressLine1 && { line1: state.addressLine1 }),
        ...(state.addressLine2 && { line2: state.addressLine2 }),
        ...(state.city && { city: state.city }),
        ...(state.state && { state: state.state }),
        ...(state.postalCode && { postal_code: state.postalCode }),
        country: state.country ?? '',
    };

    if (state.type === 'ORGANIZATION') {
        return {
            type: 'ORGANIZATION',
            organization: {
                legal_name: state.companyLegalName ?? '',
                registered_address: address,
                ...(state.companyVatNumber && {
                    tax_ids: [{ id: state.companyVatNumber, type: DEFAULT_TAX_IDENTIFIER_TYPE }],
                }),
            },
        };
    }

    return {
        type: 'INDIVIDUAL',
        individual: {
            residential_address: address,
        },
    };
};
