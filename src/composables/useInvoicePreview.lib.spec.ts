import type { Customer } from '@solvimon/solvimon-types';
import { buildAddress, buildCustomerPayload, getCustomerAddress } from './useInvoicePreview.lib';

describe('useInvoicePreview.lib', () => {
    describe('getCustomerAddress', () => {
        it('reads the residential address of an individual', () => {
            expect(
                getCustomerAddress({
                    type: 'INDIVIDUAL',
                    individual: { residential_address: { country: 'NL', city: 'Amsterdam' } },
                }),
            ).toEqual({ country: 'NL', city: 'Amsterdam' });
        });

        it('reads the registered address of an organization', () => {
            expect(
                getCustomerAddress({
                    type: 'ORGANIZATION',
                    organization: {
                        legal_name: 'Acme Corp',
                        registered_address: { country: 'CA', state: 'ON' },
                    },
                }),
            ).toEqual({ country: 'CA', state: 'ON' });
        });

        it('returns undefined when no address is known', () => {
            expect(getCustomerAddress({})).toBeUndefined();
            expect(getCustomerAddress({ type: 'INDIVIDUAL' })).toBeUndefined();
        });
    });

    describe('buildAddress', () => {
        it('keeps only the fields that are filled in', () => {
            expect(
                buildAddress({
                    type: 'INDIVIDUAL',
                    individual: {
                        residential_address: {
                            line1: 'Main street 1',
                            line2: '',
                            city: 'Amsterdam',
                            state: '',
                            postal_code: '1000AA',
                            country: 'NL',
                        },
                    },
                }),
            ).toEqual({
                line1: 'Main street 1',
                city: 'Amsterdam',
                postal_code: '1000AA',
                country: 'NL',
            });
        });

        it('falls back to the placeholder country when none is given', () => {
            expect(buildAddress({})).toEqual({ country: 'NL' });
            expect(
                buildAddress({
                    type: 'INDIVIDUAL',
                    individual: { residential_address: { country: '' } },
                }),
            ).toEqual({ country: 'NL' });
        });
    });

    describe('buildCustomerPayload', () => {
        it('defaults to an individual customer when no details are given', () => {
            expect(buildCustomerPayload({})).toEqual({
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: { country: 'NL' },
                },
            });
        });

        it('builds an individual customer with a residential address', () => {
            expect(
                buildCustomerPayload({
                    type: 'INDIVIDUAL',
                    individual: {
                        residential_address: { line1: 'Main street 1', country: 'NL' },
                    },
                }),
            ).toEqual({
                type: 'INDIVIDUAL',
                individual: {
                    residential_address: { line1: 'Main street 1', country: 'NL' },
                },
            });
        });

        it('builds an organization customer with a registered address and valid tax id', () => {
            expect(
                buildCustomerPayload({
                    type: 'ORGANIZATION',
                    organization: {
                        legal_name: 'Acme Corp',
                        registered_address: { city: 'Amsterdam', country: 'NL' },
                        tax_ids: [{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }],
                    },
                }),
            ).toEqual({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: 'Acme Corp',
                    registered_address: { city: 'Amsterdam', country: 'NL' },
                    tax_id: 'NL123456789B01',
                },
            });
        });

        it('drops an invalid tax id and falls back to the placeholder legal name', () => {
            const payload = buildCustomerPayload({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: '',
                    registered_address: { country: 'NL' },
                    tax_ids: [{ id: 'not-a-vat-number', type: 'GENERIC_TAX_ID' }],
                },
            } as Partial<Customer>);

            expect(payload).toEqual({
                type: 'ORGANIZATION',
                organization: {
                    legal_name: 'preview',
                    registered_address: { country: 'NL' },
                    tax_id: undefined,
                },
            });
        });
    });
});
