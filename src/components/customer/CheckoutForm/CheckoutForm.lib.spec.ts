import {
    billingAddressFromShipping,
    countrySpecificRequiredFieldsMap,
    getRequiredFieldsForCountry,
    getRequiredShippingFieldsForCountry,
    isShippingField,
    toCustomer,
    toShippingAddressDetails,
} from './CheckoutForm.lib';
import type { CheckoutFormState } from './CheckoutForm.types';

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

        it('leaves out a VAT number a US company cannot see', () => {
            const customer = toCustomer({
                type: 'ORGANIZATION',
                companyLegalName: 'Acme Inc.',
                companyVatNumber: 'NL863950310B01',
                country: 'US',
            });

            expect(customer).not.toHaveProperty('organization.tax_ids');
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

    describe('getRequiredShippingFieldsForCountry', () => {
        it('asks for everything a parcel needs to arrive', () => {
            expect(getRequiredShippingFieldsForCountry('NL')).toEqual([
                'shippingAddressLine1',
                'shippingPostalCode',
                'shippingCity',
                'shippingCountry',
                'shippingPhoneNumber',
                'shippingLastName',
            ]);
        });

        it('asks for no last name when the parcel goes to a company', () => {
            expect(
                getRequiredShippingFieldsForCountry('NL', { type: 'ORGANIZATION' }),
            ).not.toContain('shippingLastName');
        });

        it('asks for what the destination country requires once its format is known', () => {
            const unitedStates = { fields: 'ACSZ', required: 'ACSZ' };

            expect(getRequiredShippingFieldsForCountry('US', { format: unitedStates })).toEqual([
                'shippingAddressLine1',
                'shippingCity',
                'shippingState',
                'shippingPostalCode',
                'shippingCountry',
                'shippingPhoneNumber',
                'shippingLastName',
            ]);
        });

        it('asks for no postal code where the country has none', () => {
            const hongKong = { fields: 'ACS', required: 'AS' };

            expect(getRequiredShippingFieldsForCountry('HK', { format: hongKong })).not.toContain(
                'shippingPostalCode',
            );
        });

        it('adds what the destination country asks of an address of its own', () => {
            expect(getRequiredShippingFieldsForCountry('CA')).toContain('shippingState');
        });

        it('asks the same of an unknown destination as of any other', () => {
            expect(getRequiredShippingFieldsForCountry(undefined)).toEqual(
                getRequiredShippingFieldsForCountry('NL'),
            );
        });

        // US adds line 1 and a postal code, which a parcel needs anyway.
        it('names a field once where both rules ask for it', () => {
            const fields = getRequiredShippingFieldsForCountry('US');

            expect(fields).toEqual([...new Set(fields)]);
        });
    });

    describe('isShippingField', () => {
        it('tells the two addresses apart', () => {
            expect(isShippingField('shippingAddressLine1')).toBe(true);
            expect(isShippingField('addressLine1')).toBe(false);
        });
    });

    describe('toShippingAddressDetails', () => {
        const shipped = {
            email: 'jane@example.com',
            shippingAddressLine1: 'Main street 1',
            shippingAddressLine2: undefined,
            shippingPostalCode: '1000AA',
            shippingCity: 'Amsterdam',
            shippingState: undefined,
            shippingCountry: 'NL',
            shippingPhoneNumber: '+31 6 12345678',
        } as const;

        it('ships to a person, with the address the customer gave', () => {
            expect(
                toShippingAddressDetails(
                    {
                        ...shipped,
                        type: 'INDIVIDUAL',
                        shippingFirstName: 'Jane',
                        shippingLastName: 'Doe',
                    } as CheckoutFormState,
                    'ref_1',
                ),
            ).toEqual({
                reference: 'ref_1',
                recipient: {
                    type: 'INDIVIDUAL',
                    individual: { name: { first_name: 'Jane', last_name: 'Doe' } },
                    phone_number: '+31 6 12345678',
                    email: 'jane@example.com',
                },
                address: {
                    line1: 'Main street 1',
                    postal_code: '1000AA',
                    city: 'Amsterdam',
                    country: 'NL',
                },
            });
        });

        it('ships to a company by its legal name', () => {
            const details = toShippingAddressDetails(
                {
                    ...shipped,
                    type: 'ORGANIZATION',
                    companyLegalName: 'Acme B.V.',
                } as CheckoutFormState,
                'ref_1',
            );

            expect(details.recipient.organization).toEqual({ company_name: 'Acme B.V.' });
            expect(details.recipient.individual).toBeUndefined();
        });

        it('ships to a company for the attention of the person the customer names', () => {
            const details = toShippingAddressDetails(
                {
                    ...shipped,
                    type: 'ORGANIZATION',
                    companyLegalName: 'Acme B.V.',
                    shippingAttentionName: ' Jane Doe ',
                } as CheckoutFormState,
                'ref_1',
            );

            expect(details.recipient.organization).toEqual({
                company_name: 'Acme B.V.',
                attention_name: 'Jane Doe',
            });
        });

        it('leaves out what the destination country does not use', () => {
            const hongKong = { fields: 'ACS', required: 'AS' };
            const details = toShippingAddressDetails(
                { ...shipped, shippingCountry: 'HK' } as CheckoutFormState,
                'ref_1',
                hongKong,
            );

            expect(details.address).not.toHaveProperty('postal_code');
            expect(details.address.city).toBe('Amsterdam');
        });

        it('sends a postal code trimmed and in capitals', () => {
            const details = toShippingAddressDetails(
                { ...shipped, shippingPostalCode: ' 1000aa ' } as CheckoutFormState,
                'ref_1',
            );

            expect(details.address.postal_code).toBe('1000AA');
        });

        // The API asks for a name object on a person, but nothing inside it.
        it('sends an empty name for a person the form has no name for', () => {
            const details = toShippingAddressDetails(
                { ...shipped, type: 'INDIVIDUAL' } as CheckoutFormState,
                'ref_1',
            );

            expect(details.recipient.individual).toEqual({ name: {} });
        });
    });

    describe('billingAddressFromShipping', () => {
        it('reads the billing address off the shipping one', () => {
            expect(
                billingAddressFromShipping({
                    shippingAddressLine1: 'Main street 1',
                    shippingAddressLine2: 'Second floor',
                    shippingPostalCode: '1000AA',
                    shippingCity: 'Amsterdam',
                    shippingState: undefined,
                    shippingCountry: 'NL',
                } as CheckoutFormState),
            ).toEqual({
                addressLine1: 'Main street 1',
                addressLine2: 'Second floor',
                postalCode: '1000AA',
                city: 'Amsterdam',
                state: undefined,
                country: 'NL',
            });
        });
    });
});
