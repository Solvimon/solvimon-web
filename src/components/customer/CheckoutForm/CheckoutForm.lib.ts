import type { Address, CountryCode, Customer } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from './CheckoutForm.types';
import type { ShippingAddressDetails } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

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

/** The VAT number is asked for on a company purchase only, and not in the US. */
export const isVatNumberShown = (
    state: Partial<Pick<CheckoutFormState, 'type' | 'country'>>,
): boolean => state.type === 'ORGANIZATION' && state.country !== 'US';

/** The shipping counterpart of each billing field, for rules written against billing ones. */
const BILLING_TO_SHIPPING_FIELDS: Partial<Record<keyof CheckoutFormState, ShippingField>> = {
    addressLine1: 'shippingAddressLine1',
    addressLine2: 'shippingAddressLine2',
    postalCode: 'shippingPostalCode',
    city: 'shippingCity',
    state: 'shippingState',
    country: 'shippingCountry',
};

export type ShippingField =
    | 'shippingAddressLine1'
    | 'shippingAddressLine2'
    | 'shippingPostalCode'
    | 'shippingCity'
    | 'shippingState'
    | 'shippingCountry'
    | 'shippingPhoneNumber';

/** Whether a field belongs to the shipping address rather than the billing one. */
export const isShippingField = (field: keyof CheckoutFormState): field is ShippingField =>
    field.startsWith('shipping');

/** A parcel needs all of these to arrive, whatever the country asks of a billing address. */
const ALWAYS_REQUIRED_SHIPPING_FIELDS: ShippingField[] = [
    'shippingAddressLine1',
    'shippingPostalCode',
    'shippingCity',
    'shippingCountry',
    'shippingPhoneNumber',
];

/**
 * The shipping fields a customer has to fill in: what every parcel needs, plus whatever the
 * destination country asks for on an address of its own — a state in Canada, for instance.
 */
export const getRequiredShippingFieldsForCountry = (
    country: CountryCode | undefined,
): ShippingField[] => {
    const countrySpecific = getRequiredFieldsForCountry(country)
        .map((billingField) => BILLING_TO_SHIPPING_FIELDS[billingField])
        .filter((field) => field !== undefined);

    return [...new Set([...ALWAYS_REQUIRED_SHIPPING_FIELDS, ...countrySpecific])];
};

/** The billing half of the form state — what an address the customer is invoiced at fills in. */
export type BillingAddressFields = Pick<
    CheckoutFormState,
    'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'state' | 'country'
>;

/**
 * The billing address as the shipping one, for while the customer asks to be billed where the
 * order ships. Everything downstream reads the billing fields, so the copy happens once here
 * rather than teaching each consumer about shipping.
 */
export const billingAddressFromShipping = (state: CheckoutFormState): BillingAddressFields => ({
    addressLine1: state.shippingAddressLine1,
    addressLine2: state.shippingAddressLine2,
    postalCode: state.shippingPostalCode,
    city: state.shippingCity,
    state: state.shippingState,
    country: state.shippingCountry,
});

/**
 * The shipping address as the authorize call takes it. The recipient is the customer: a company
 * by its legal name, a person by whatever name the form holds, as the API asks for no more.
 */
export const toShippingAddressDetails = (
    state: CheckoutFormState,
    reference: string,
): ShippingAddressDetails => ({
    reference,
    recipient: {
        type: state.type,
        ...(state.type === 'ORGANIZATION'
            ? { organization: { company_name: state.companyLegalName ?? '' } }
            : {
                  individual: {
                      name: {
                          ...(state.firstName && { first_name: state.firstName }),
                          ...(state.infix && { infix: state.infix }),
                          ...(state.lastName && { last_name: state.lastName }),
                      },
                  },
              }),
        phone_number: state.shippingPhoneNumber ?? '',
        email: state.email ?? '',
    },
    address: {
        ...(state.shippingAddressLine1 && { line1: state.shippingAddressLine1 }),
        ...(state.shippingAddressLine2 && { line2: state.shippingAddressLine2 }),
        ...(state.shippingCity && { city: state.shippingCity }),
        ...(state.shippingState && { state: state.shippingState }),
        ...(state.shippingPostalCode && { postal_code: state.shippingPostalCode }),
        country: state.shippingCountry ?? '',
    },
});

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
                ...(state.companyVatNumber &&
                    isVatNumberShown(state) && {
                        tax_ids: [
                            { id: state.companyVatNumber, type: DEFAULT_TAX_IDENTIFIER_TYPE },
                        ],
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
