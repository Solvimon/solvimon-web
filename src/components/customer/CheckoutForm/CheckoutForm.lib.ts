import type { Address, CountryCode, Customer } from '@solvimon/solvimon-types';
import type { CheckoutFormState } from './CheckoutForm.types';
import type { AddressFieldCode, AddressFormat } from './addressFormat';
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

export type AddressVariant = 'BILLING' | 'SHIPPING';

export type AddressPart = 'line1' | 'line2' | 'postalCode' | 'city' | 'state';

export const ADDRESS_KEYS = {
    BILLING: {
        line1: 'addressLine1',
        line2: 'addressLine2',
        postalCode: 'postalCode',
        city: 'city',
        state: 'state',
        country: 'country',
    },
    SHIPPING: {
        line1: 'shippingAddressLine1',
        line2: 'shippingAddressLine2',
        postalCode: 'shippingPostalCode',
        city: 'shippingCity',
        state: 'shippingState',
        country: 'shippingCountry',
    },
} as const satisfies Record<
    AddressVariant,
    Record<AddressPart | 'country', keyof CheckoutFormState>
>;

const ADDRESS_KEY_PARTS = ['line1', 'line2', 'postalCode', 'city', 'state', 'country'] as const;

const ADDRESS_FIELD_CODES: AddressFieldCode[] = ['A', 'C', 'S', 'Z'];

const PARTS_BY_CODE: Record<AddressFieldCode, AddressPart[]> = {
    A: ['line1', 'line2'],
    C: ['city'],
    S: ['state'],
    Z: ['postalCode'],
};

const partsFor = (codes: string): AddressPart[] =>
    ADDRESS_FIELD_CODES.filter((code) => codes.includes(code)).flatMap(
        (code) => PARTS_BY_CODE[code],
    );

export const getAddressParts = (format?: AddressFormat): AddressPart[] =>
    partsFor(format?.fields ?? 'ACSZ');

export const getTaxedAddressFields = (
    variant: AddressVariant,
    country: CountryCode | undefined,
): (keyof CheckoutFormState)[] => {
    const required = getRequiredFieldsForCountry(country);
    return ADDRESS_KEY_PARTS.filter((part) => required.includes(ADDRESS_KEYS.BILLING[part])).map(
        (part) => ADDRESS_KEYS[variant][part],
    );
};

export const getRequiredAddressFields = (
    variant: AddressVariant,
    country: CountryCode | undefined,
    format?: AddressFormat,
): (keyof CheckoutFormState)[] => {
    const parts: AddressPart[] = format
        ? partsFor(format.required).filter((part) => part !== 'line2')
        : ['line1', 'postalCode', 'city'];

    return [
        ...new Set([
            ...parts.map((part) => ADDRESS_KEYS[variant][part]),
            ...getTaxedAddressFields(variant, country),
        ]),
    ];
};

const cleaned = (value: string | undefined): string | undefined => value?.trim() || undefined;

// Only the parts the country uses: the others may still hold what was typed for another country.
export const readAddress = (
    state: Partial<CheckoutFormState>,
    variant: AddressVariant,
    format?: AddressFormat,
): Address => {
    const keys = ADDRESS_KEYS[variant];
    const used = new Set(getAddressParts(format));
    const value = (part: AddressPart) => (used.has(part) ? cleaned(state[keys[part]]) : undefined);
    const postalCode = value('postalCode')?.toUpperCase();

    return {
        ...(value('line1') && { line1: value('line1') }),
        ...(value('line2') && { line2: value('line2') }),
        ...(value('city') && { city: value('city') }),
        ...(value('state') && { state: value('state') }),
        ...(postalCode && { postal_code: postalCode }),
        country: state[keys.country] ?? '',
    };
};

export const billingAddressFromShipping = (
    state: CheckoutFormState,
    format?: AddressFormat,
): Pick<
    CheckoutFormState,
    'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'state' | 'country'
> => {
    const address = readAddress(state, 'SHIPPING', format);

    return {
        addressLine1: address.line1,
        addressLine2: address.line2,
        postalCode: address.postal_code,
        city: address.city,
        state: address.state,
        country: state.shippingCountry,
    };
};

export const toShippingAddressDetails = (
    state: CheckoutFormState,
    reference: string,
    format?: AddressFormat,
): ShippingAddressDetails => {
    const attentionName = cleaned(state.shippingAttentionName);
    const firstName = cleaned(state.shippingFirstName);
    const lastName = cleaned(state.shippingLastName);

    return {
        reference,
        recipient: {
            type: state.type,
            ...(state.type === 'ORGANIZATION'
                ? {
                      organization: {
                          company_name: state.companyLegalName ?? '',
                          ...(attentionName && { attention_name: attentionName }),
                      },
                  }
                : {
                      individual: {
                          name: {
                              ...(firstName && { first_name: firstName }),
                              ...(lastName && { last_name: lastName }),
                          },
                      },
                  }),
            phone_number: state.shippingPhoneNumber?.trim() ?? '',
            email: state.email ?? '',
        },
        address: readAddress(state, 'SHIPPING', format),
    };
};

// A shipped order is taxed where it ships, but its VAT number belongs to the customer billed.
export const toPreviewCustomer = (
    state: CheckoutFormState,
    { isShipped, format }: { isShipped: boolean; format?: AddressFormat },
): Partial<Customer> =>
    toCustomer(isShipped ? { ...state, ...billingAddressFromShipping(state, format) } : state, {
        withVatNumber: isVatNumberShown(state),
    });

/**
 * Map the checkout form state onto the customer it describes, so consumers that work with
 * customers (the invoice preview for instance) do not have to know about this form.
 */
export const toCustomer = (
    state: Partial<CheckoutFormState>,
    { withVatNumber = isVatNumberShown(state) }: { withVatNumber?: boolean } = {},
): Partial<Customer> => {
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
                    withVatNumber && {
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

/** A complete form state, every field unset unless given. */
export const getInitialState = (
    initialState: Partial<CheckoutFormState> = {},
): CheckoutFormState => {
    return {
        email: undefined,
        country: undefined,
        type: 'INDIVIDUAL',
        companyLegalName: undefined,
        firstName: undefined,
        infix: undefined,
        lastName: undefined,
        addressLine1: undefined,
        addressLine2: undefined,
        postalCode: undefined,
        city: undefined,
        state: undefined,
        companyVatNumber: undefined,
        shippingAddressLine1: undefined,
        shippingAddressLine2: undefined,
        shippingPostalCode: undefined,
        shippingCity: undefined,
        shippingState: undefined,
        shippingCountry: undefined,
        shippingPhoneNumber: undefined,
        shippingFirstName: undefined,
        shippingLastName: undefined,
        shippingAttentionName: undefined,
        billingAddressSameAsShipping: true,
        seatsValues: undefined,
        unitsValues: undefined,
        enabledPricingIds: undefined,
        ...initialState,
    };
};
