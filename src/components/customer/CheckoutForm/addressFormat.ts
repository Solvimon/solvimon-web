/** libaddressinput's letters for street, city, state and postal code. */
export type AddressFieldCode = 'A' | 'C' | 'S' | 'Z';

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

export const loadAddressFormats = (): Promise<AddressFormatTable> => {
    table ??= import('./addressFormats.data').catch((error: unknown) => {
        // Not remembered, so a failed download is tried again.
        table = undefined;
        throw error;
    });
    return table;
};

export const getAddressFormat = (
    formats: AddressFormatTable,
    country: string | undefined,
): AddressFormat => (country && formats.ADDRESS_FORMATS[country]) || formats.DEFAULT_ADDRESS_FORMAT;

export const isPostalCodeValid = (format: AddressFormat, postalCode: string): boolean =>
    !format.postalCode || new RegExp(`^(?:${format.postalCode})$`, 'i').test(postalCode.trim());

/** 7 to 15 digits, the range E.164 allows, with the usual separators. */
export const isPhoneNumberPlausible = (phoneNumber: string): boolean => {
    const trimmed = phoneNumber.trim();
    if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return false;

    const digits = trimmed.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
};
