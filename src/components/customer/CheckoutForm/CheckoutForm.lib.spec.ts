import { countrySpecificRequiredFieldsMap, getRequiredFieldsForCountry } from './CheckoutForm.lib';

describe('CheckoutForm.lib', () => {
    it('returns the configured required fields for countries with specific rules', () => {
        expect(countrySpecificRequiredFieldsMap.US).toEqual(['addressLine1', 'postalCode']);
        expect(getRequiredFieldsForCountry('US')).toEqual([
            'addressLine1',
            'postalCode',
            'email',
            'country',
        ]);
        expect(countrySpecificRequiredFieldsMap.CA).toEqual(['state']);
        expect(getRequiredFieldsForCountry('CA')).toEqual(['state', 'email', 'country']);
    });

    it('defaults to email and country for countries without specific configuration', () => {
        expect(getRequiredFieldsForCountry('NL')).toEqual(['email', 'country']);
    });
});
