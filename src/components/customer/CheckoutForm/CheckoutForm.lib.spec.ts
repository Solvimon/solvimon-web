import {
    countrySpecificRequiredFieldsMap,
    getRequiredFieldsForCountry,
    toCustomer,
} from './CheckoutForm.lib';

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

    describe('toCustomer', () => {
        it('maps an individual form state onto a residential address', () => {
            expect(
                toCustomer({
                    type: 'INDIVIDUAL',
                    country: 'NL',
                    addressLine1: 'Main street 1',
                    addressLine2: 'Second floor',
                    city: 'Amsterdam',
                    postalCode: '1000AA',
                }),
            ).toEqual({
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: {
                        line1: 'Main street 1',
                        line2: 'Second floor',
                        city: 'Amsterdam',
                        postal_code: '1000AA',
                        country: 'NL',
                    },
                },
            });
        });

        it('maps an organization form state onto a registered address and tax id', () => {
            expect(
                toCustomer({
                    type: 'ORGANIZATION',
                    country: 'CA',
                    state: 'ON',
                    companyLegalName: 'Acme Corp',
                    companyVatNumber: 'NL123456789B01',
                }),
            ).toEqual({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: 'Acme Corp',
                    registered_address: {
                        state: 'ON',
                        country: 'CA',
                    },
                    tax_ids: [{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }],
                },
            });
        });

        it('omits empty fields so consumers can apply their own defaults', () => {
            expect(toCustomer({})).toEqual({
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: {
                        country: '',
                    },
                },
            });
        });
    });
});
