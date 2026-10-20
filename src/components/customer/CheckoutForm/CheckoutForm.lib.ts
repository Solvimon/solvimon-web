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
    | 'shippingPhoneNumber'
    | 'shippingFirstName'
    | 'shippingLastName'
    | 'shippingAttentionName';

/** The shipping address fields that a country may or may not use. */
export type ShippingAddressField =
    | 'shippingAddressLine1'
    | 'shippingAddressLine2'
    | 'shippingPostalCode'
    | 'shippingCity'
    | 'shippingState';

/** Whether a field belongs to the shipping address rather than the billing one. */
export const isShippingField = (field: keyof CheckoutFormState): field is ShippingField =>
    field.startsWith('shipping');

/** Used until the destination country's format has loaded. */
const FALLBACK_REQUIRED_SHIPPING_FIELDS: ShippingField[] = [
    'shippingAddressLine1',
    'shippingPostalCode',
    'shippingCity',
];

const FIELDS_BY_CODE: Record<AddressFieldCode, ShippingAddressField[]> = {
    A: ['shippingAddressLine1', 'shippingAddressLine2'],
    C: ['shippingCity'],
    S: ['shippingState'],
    Z: ['shippingPostalCode'],
};

const ADDRESS_FIELD_CODES: AddressFieldCode[] = ['A', 'C', 'S', 'Z'];

const fieldsForCodes = (codes: string): ShippingAddressField[] =>
    ADDRESS_FIELD_CODES.filter((code) => codes.includes(code)).flatMap(
        (code) => FIELDS_BY_CODE[code],
    );

/** The address fields the destination country uses; every one until its format has loaded. */
export const getShippingAddressFields = (format?: AddressFormat): ShippingAddressField[] =>
    fieldsForCodes(format?.fields ?? 'ACSZ');

/**
 * The shipping fields a customer has to fill in: the address fields the destination country
 * requires, the country, a phone number the API requires, and a last name when the parcel goes
 * to a person. Until the country's format has loaded, the rules the billing address uses for
 * that country stand in, on top of a street, postal code and city.
 */
export const getRequiredShippingFieldsForCountry = (
    country: CountryCode | undefined,
    { format, type }: { format?: AddressFormat; type?: CheckoutFormState['type'] } = {},
): ShippingField[] => {
    const addressFields: ShippingField[] = format
        ? fieldsForCodes(format.required).filter((field) => field !== 'shippingAddressLine2')
        : [
              ...FALLBACK_REQUIRED_SHIPPING_FIELDS,
              ...getRequiredFieldsForCountry(country)
                  .map((billingField) => BILLING_TO_SHIPPING_FIELDS[billingField])
                  .filter((field) => field !== undefined),
          ];

    const recipientFields: ShippingField[] = type === 'ORGANIZATION' ? [] : ['shippingLastName'];

    return [
        ...new Set<ShippingField>([
            ...addressFields,
            'shippingCountry',
            'shippingPhoneNumber',
            ...recipientFields,
        ]),
    ];
};

/** The billing field each libaddressinput code stands for; line 2 is never required. */
const BILLING_ADDRESS_FIELD_BY_CODE: Record<AddressFieldCode, keyof CheckoutFormState> = {
    A: 'addressLine1',
    C: 'city',
    S: 'state',
    Z: 'postalCode',
};

/** Used for a separate billing address until the billing country's format has loaded. */
const FALLBACK_REQUIRED_BILLING_ADDRESS_FIELDS: (keyof CheckoutFormState)[] = [
    'addressLine1',
    'postalCode',
    'city',
];

/**
 * The fields a billing address apart from the shipping one has to fill in: the address fields
 * the billing country requires, on top of what that country asks of a billing address anyway.
 * Until the country's format has loaded, a street, postal code and city stand in.
 */
export const getRequiredBillingAddressFieldsForCountry = (
    country: CountryCode | undefined,
    format?: AddressFormat,
): (keyof CheckoutFormState)[] => {
    const addressFields = format
        ? ADDRESS_FIELD_CODES.filter((code) => format.required.includes(code)).map(
              (code) => BILLING_ADDRESS_FIELD_BY_CODE[code],
          )
        : FALLBACK_REQUIRED_BILLING_ADDRESS_FIELDS;

    return [...new Set([...addressFields, ...getRequiredFieldsForCountry(country)])];
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
export const billingAddressFromShipping = (
    state: CheckoutFormState,
    format?: AddressFormat,
): BillingAddressFields => {
    // A field the destination country does not use may still hold what was typed for another.
    const used = new Set(getShippingAddressFields(format));
    const value = (field: ShippingAddressField) => (used.has(field) ? state[field] : undefined);

    return {
        addressLine1: value('shippingAddressLine1'),
        addressLine2: value('shippingAddressLine2'),
        postalCode: value('shippingPostalCode'),
        city: value('shippingCity'),
        state: value('shippingState'),
        country: state.shippingCountry,
    };
};

/**
 * The shipping address as the authorize call takes it. A company receives the parcel by its legal
 * name, to the attention of whoever the customer names; a person by the name given for shipping.
 * Fields the destination country does not use are left out, even if the customer filled them in
 * for a country they picked before.
 */
export const toShippingAddressDetails = (
    state: CheckoutFormState,
    reference: string,
    format?: AddressFormat,
): ShippingAddressDetails => {
    const used = new Set(getShippingAddressFields(format));
    const value = (field: ShippingAddressField) =>
        used.has(field) ? state[field]?.trim() || undefined : undefined;
    const postalCode = value('shippingPostalCode')?.toUpperCase();

    return {
        reference,
        recipient: {
            type: state.type,
            ...(state.type === 'ORGANIZATION'
                ? {
                      organization: {
                          company_name: state.companyLegalName ?? '',
                          ...(state.shippingAttentionName?.trim() && {
                              attention_name: state.shippingAttentionName.trim(),
                          }),
                      },
                  }
                : {
                      individual: {
                          name: {
                              ...(state.shippingFirstName?.trim() && {
                                  first_name: state.shippingFirstName.trim(),
                              }),
                              ...(state.shippingLastName?.trim() && {
                                  last_name: state.shippingLastName.trim(),
                              }),
                          },
                      },
                  }),
            phone_number: state.shippingPhoneNumber?.trim() ?? '',
            email: state.email ?? '',
        },
        address: {
            ...(value('shippingAddressLine1') && { line1: value('shippingAddressLine1') }),
            ...(value('shippingAddressLine2') && { line2: value('shippingAddressLine2') }),
            ...(value('shippingCity') && { city: value('shippingCity') }),
            ...(value('shippingState') && { state: value('shippingState') }),
            ...(postalCode && { postal_code: postalCode }),
            country: state.shippingCountry ?? '',
        },
    };
};

/**
 * The shipping fields that change the price of a shipped order, which is taxed where it ships:
 * the country, and whatever else that country requires of an address for its taxes.
 */
export const getShippingPreviewFields = (country: CountryCode | undefined): ShippingField[] => [
    'shippingCountry',
    ...getRequiredFieldsForCountry(country)
        .map((billingField) => BILLING_TO_SHIPPING_FIELDS[billingField])
        .filter((field) => field !== undefined),
];

/**
 * The customer the invoice preview is priced for. A shipped order is taxed where it ships, so its
 * preview reads the shipping address; any other order reads the billing address.
 */
export const toPreviewCustomer = (
    state: CheckoutFormState,
    { isShipped, format }: { isShipped: boolean; format?: AddressFormat },
): Partial<Customer> =>
    toCustomer(isShipped ? { ...state, ...billingAddressFromShipping(state, format) } : state);

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
