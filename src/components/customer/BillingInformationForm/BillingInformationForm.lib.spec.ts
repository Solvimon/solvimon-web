import type { Customer } from '@solvimon/solvimon-types';
import {
    getBillingInformationFormApiErrors,
    hasBillingAddress,
} from './BillingInformationForm.lib';

describe('getBillingInformationFormApiErrors', () => {
    const visibleFields = [
        'email',
        'country',
        'addressLine1',
        'postalCode',
        'companyLegalName',
        'companyVatNumber',
    ] as const;

    it('returns nothing without an error', () => {
        expect(getBillingInformationFormApiErrors(undefined, visibleFields)).toEqual({
            fields: {},
        });
    });

    it.each([
        ['email', 'email'],
        ['organization.tax_ids[0].id', 'companyVatNumber'],
        ['organization.tax_ids', 'companyVatNumber'],
        ['organization.legal_name', 'companyLegalName'],
        ['organization.registered_address.line1', 'addressLine1'],
        ['organization.registered_address.country', 'country'],
        ['postal_code', 'postalCode'],
        ['vat_number', 'companyVatNumber'],
    ])('puts an error on `%s` on the %s field', (path, field) => {
        expect(getBillingInformationFormApiErrors({ [path]: 'Invalid' }, visibleFields)).toEqual({
            fields: { [field]: 'Invalid' },
        });
    });

    it('reports a generic error as such', () => {
        expect(
            getBillingInformationFormApiErrors({ _generic: 'Something broke' }, visibleFields),
        ).toEqual({ fields: {}, generic: 'Something broke' });
    });

    it('reports an error on a field the form does not show as a generic one', () => {
        expect(getBillingInformationFormApiErrors({ reference: 'Taken' }, visibleFields)).toEqual({
            fields: {},
            generic: 'Taken',
        });
        expect(
            getBillingInformationFormApiErrors(
                { 'individual.name.first_name': 'Required' },
                visibleFields,
            ),
        ).toEqual({ fields: {}, generic: 'Required' });
    });
});

describe('hasBillingAddress', () => {
    it.each([
        ['no customer', undefined, false],
        [
            'a country only',
            { type: 'INDIVIDUAL', individual: { residential_address: { country: 'NL' } } },
            false,
        ],
        [
            'a blank first line',
            { type: 'ORGANIZATION', organization: { registered_address: { line1: ' ' } } },
            false,
        ],
        [
            'a person with a first line',
            { type: 'INDIVIDUAL', individual: { residential_address: { line1: 'Dam 1' } } },
            true,
        ],
        [
            'a company with a first line',
            { type: 'ORGANIZATION', organization: { registered_address: { line1: 'Dam 1' } } },
            true,
        ],
    ])('is %s: %s', (_, customer, expected) => {
        expect(hasBillingAddress(customer as Customer | undefined)).toBe(expected);
    });
});
