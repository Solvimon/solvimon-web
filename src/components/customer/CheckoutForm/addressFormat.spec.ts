import {
    getAddressFormat,
    isPhoneNumberPlausible,
    isPostalCodeValid,
    loadAddressFormats,
} from './addressFormat';

describe('addressFormat', () => {
    describe('getAddressFormat', () => {
        it('knows what each country requires of an address', async () => {
            const formats = await loadAddressFormats();

            expect(getAddressFormat(formats, 'US').required).toBe('ACSZ');
            expect(getAddressFormat(formats, 'HK').fields).not.toContain('Z');
            expect(getAddressFormat(formats, 'IE').required).not.toContain('Z');
        });

        it('falls back to a street and a city for a country it does not know', async () => {
            const formats = await loadAddressFormats();

            expect(getAddressFormat(formats, undefined)).toEqual(formats.DEFAULT_ADDRESS_FORMAT);
            expect(formats.DEFAULT_ADDRESS_FORMAT.required).toBe('AC');
        });
    });

    describe('isPostalCodeValid', () => {
        const netherlands = { fields: 'ACZ', required: 'ACZ', postalCode: '[1-9]\\d{3} ?[A-Z]{2}' };

        it('takes a postal code in the format of the country, in any case', () => {
            expect(isPostalCodeValid(netherlands, '1000 AA')).toBe(true);
            expect(isPostalCodeValid(netherlands, '1000aa')).toBe(true);
            expect(isPostalCodeValid(netherlands, ' 1000AA ')).toBe(true);
        });

        it('turns down one that does not match', () => {
            expect(isPostalCodeValid(netherlands, '10000')).toBe(false);
            expect(isPostalCodeValid(netherlands, '1000 AA extra')).toBe(false);
        });

        it('takes anything where the country has no pattern', () => {
            expect(isPostalCodeValid({ fields: 'AC', required: 'AC' }, 'anything')).toBe(true);
        });
    });

    describe('isPhoneNumberPlausible', () => {
        it('takes digits with the usual separators and a leading plus', () => {
            expect(isPhoneNumberPlausible('+31 6 12345678')).toBe(true);
            expect(isPhoneNumberPlausible('(020) 123-4567')).toBe(true);
        });

        it('turns down letters, too few digits and too many', () => {
            expect(isPhoneNumberPlausible('call me')).toBe(false);
            expect(isPhoneNumberPlausible('-')).toBe(false);
            expect(isPhoneNumberPlausible('123456')).toBe(false);
            expect(isPhoneNumberPlausible('+1234567890123456')).toBe(false);
        });
    });
});
