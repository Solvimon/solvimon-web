import {
    billingAddressFromShipping,
    countrySpecificRequiredFieldsMap,
    getRequiredAddressFields,
    getRequiredFieldsForCountry,
    readAddress,
    toCustomer,
    toPreviewCustomer,
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

    describe('getRequiredAddressFields', () => {
        it('asks for a street, postal code and city until the country format is known', () => {
            expect(getRequiredAddressFields('SHIPPING', 'NL')).toEqual([
                'shippingAddressLine1',
                'shippingPostalCode',
                'shippingCity',
                'shippingCountry',
            ]);
            expect(getRequiredAddressFields('BILLING', 'NL')).toEqual([
                'addressLine1',
                'postalCode',
                'city',
                'country',
            ]);
        });

        it('asks for what the country requires once its format is known', () => {
            const unitedStates = { fields: 'ACSZ', required: 'ACSZ' };

            expect(getRequiredAddressFields('SHIPPING', 'US', unitedStates)).toEqual([
                'shippingAddressLine1',
                'shippingCity',
                'shippingState',
                'shippingPostalCode',
                'shippingCountry',
            ]);
        });

        it('asks for no postal code where the country has none', () => {
            const hongKong = { fields: 'ACS', required: 'AS' };

            expect(getRequiredAddressFields('BILLING', 'HK', hongKong)).not.toContain('postalCode');
        });

        it('keeps what the country taxes by, whatever its format says', () => {
            const canadaWithoutState = { fields: 'ACZ', required: 'ACZ' };

            expect(getRequiredAddressFields('SHIPPING', 'CA', canadaWithoutState)).toContain(
                'shippingState',
            );
        });
    });

    describe('toPreviewCustomer', () => {
        const state = {
            type: 'INDIVIDUAL',
            country: 'NL',
            postalCode: '1000AA',
            billingAddressSameAsShipping: false,
            shippingCountry: 'DE',
            shippingPostalCode: '10115',
        } as CheckoutFormState;

        it('prices a shipped order where it ships', () => {
            expect(toPreviewCustomer(state, { isShipped: true })).toMatchObject({
                individual: { residential_address: { country: 'DE', postal_code: '10115' } },
            });
        });

        // The VAT field and the order itself follow the billing country, so the preview does too.
        it('keeps the VAT number of a company billed in the EU that ships to the US', () => {
            const company = {
                ...state,
                type: 'ORGANIZATION',
                companyLegalName: 'Acme',
                companyVatNumber: 'NL123456789B01',
                shippingCountry: 'US',
            } as CheckoutFormState;

            expect(toPreviewCustomer(company, { isShipped: true })).toMatchObject({
                organization: {
                    registered_address: { country: 'US' },
                    tax_ids: [{ id: 'NL123456789B01' }],
                },
            });
        });

        it('leaves out the VAT number of a company billed in the US that ships to the EU', () => {
            const company = {
                ...state,
                type: 'ORGANIZATION',
                country: 'US',
                companyLegalName: 'Acme',
                companyVatNumber: 'NL123456789B01',
                shippingCountry: 'NL',
            } as CheckoutFormState;

            expect(toPreviewCustomer(company, { isShipped: true })).not.toHaveProperty(
                'organization.tax_ids',
            );
        });

        it('prices any other order at the billing address', () => {
            expect(toPreviewCustomer(state, { isShipped: false })).toMatchObject({
                individual: { residential_address: { country: 'NL', postal_code: '1000AA' } },
            });
        });
    });

    describe('readAddress', () => {
        const shipped = {
            shippingAddressLine1: ' Main street 1 ',
            shippingAddressLine2: '  ',
            shippingPostalCode: '1012ab',
            shippingCity: 'Amsterdam',
            shippingCountry: 'NL',
        } as const;

        it('reads an address trimmed, without empty parts, its postal code in capitals', () => {
            expect(readAddress(shipped, 'SHIPPING')).toEqual({
                line1: 'Main street 1',
                postal_code: '1012AB',
                city: 'Amsterdam',
                country: 'NL',
            });
        });

        it('leaves out what the country does not use', () => {
            const hongKong = { fields: 'ACS', required: 'AS' };

            expect(readAddress(shipped, 'SHIPPING', hongKong)).not.toHaveProperty('postal_code');
        });

        it('copies the shipping address onto the billing fields', () => {
            expect(billingAddressFromShipping(shipped as CheckoutFormState)).toEqual({
                addressLine1: 'Main street 1',
                addressLine2: undefined,
                postalCode: '1012AB',
                city: 'Amsterdam',
                state: undefined,
                country: 'NL',
            });
        });
    });

    describe('toShippingAddressDetails', () => {
        const shipped = {
            email: 'jane@example.com',
            shippingAddressLine1: 'Main street 1',
            shippingPostalCode: '1000AA',
            shippingCity: 'Amsterdam',
            shippingCountry: 'NL',
            shippingPhoneNumber: '+31612345678',
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
                    phone_number: '+31612345678',
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

        it('ships to a company by its legal name, for the attention of whoever is named', () => {
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
            expect(details.recipient.individual).toBeUndefined();
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
});
