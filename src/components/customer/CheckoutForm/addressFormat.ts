/** One letter per address field, as libaddressinput names them. */
export type AddressFieldCode = 'A' | 'C' | 'S' | 'Z';

/**
 * How a country writes an address, as far as the checkout's fields go: which of street (A), city
 * (C), state (S) and postal code (Z) it uses, which of those it requires, and the pattern a
 * postal code follows.
 */
export interface AddressFormat {
    fields: string;
    required: string;
    postalCode?: string;
}

export type AddressFormatTable = Pick<
    typeof import('./addressFormats.data'),
    'ADDRESS_FORMATS' | 'DEFAULT_ADDRESS_FORMAT'
>;

let table: Promise<AddressFormatTable> | undefined;

/** The table is only needed on a checkout that ships, so it is downloaded on first use. */
export const loadAddressFormats = (): Promise<AddressFormatTable> => {
    table ??= import('./addressFormats.data').catch((error: unknown) => {
        // A failed download is tried again next time rather than remembered.
        table = undefined;
        throw error;
    });
    return table;
};

export const getAddressFormat = (
    formats: AddressFormatTable,
    country: string | undefined,
): AddressFormat => (country && formats.ADDRESS_FORMATS[country]) || formats.DEFAULT_ADDRESS_FORMAT;

/** Whether a postal code fits the country's pattern. A country without one takes anything. */
export const isPostalCodeValid = (format: AddressFormat, postalCode: string): boolean =>
    !format.postalCode || new RegExp(`^(?:${format.postalCode})$`, 'i').test(postalCode.trim());

/**
 * Whether a phone number could be dialled: digits with the usual separators and an optional
 * leading `+`, and between 7 and 15 digits, the range E.164 allows.
 */
export const isPhoneNumberPlausible = (phoneNumber: string): boolean => {
    const trimmed = phoneNumber.trim();
    if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;

    const digits = trimmed.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
};
