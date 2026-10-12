import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { Customer } from '@solvimon/solvimon-types';
import { useBillingInformationForm } from './useBillingInformationForm';

const organization = {
    id: 'cus_123',
    type: 'ORGANIZATION',
    email: 'billing@example.com',
    organization: {
        legal_name: 'Acme B.V.',
        tax_ids: [{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }],
        registered_address: { line1: 'Main street 1', city: 'Amsterdam', country: 'NL' },
    },
} as unknown as Customer;

const mountForm = (onSubmit = vi.fn().mockResolvedValue(organization)) => {
    let result: ReturnType<typeof useBillingInformationForm<Customer>> | undefined;

    mount(
        defineComponent({
            setup() {
                result = useBillingInformationForm({ onSubmit });
            },
            render: () => h('div'),
        }),
    );

    return { form: result!, onSubmit };
};

const getInvalidFields = async ({ validation }: ReturnType<typeof mountForm>['form']) => {
    await nextTick();
    await validation.value.$validate();

    return validation.value.$errors.map(({ $property }) => $property);
};

describe('useBillingInformationForm', () => {
    describe('validation', () => {
        it('accepts a complete customer', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);

            expect(await getInvalidFields(form)).toEqual([]);
        });

        it('rejects an invalid email address', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);
            form.form.value.email = 'foo';

            expect(await getInvalidFields(form)).toEqual(['email']);
        });

        it('requires a country', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);
            form.form.value.country = '';

            expect(await getInvalidFields(form)).toEqual(['country']);
        });

        it('requires a legal name for an organization only', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);
            form.form.value.companyLegalName = '';

            expect(await getInvalidFields(form)).toEqual(['companyLegalName']);

            form.form.value.type = 'INDIVIDUAL';

            expect(await getInvalidFields(form)).toEqual([]);
        });

        it('rejects a malformed VAT number', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);
            form.form.value.companyVatNumber = 'NL123';

            expect(await getInvalidFields(form)).toEqual(['companyVatNumber']);
        });

        it.each([
            ['US', ['addressLine1', 'postalCode']],
            ['CA', ['state']],
            ['NL', []],
        ])('requires the address fields %s needs', async (country, fields) => {
            const { form } = mountForm();
            form.updateInitialState(organization);
            Object.assign(form.form.value, {
                country,
                addressLine1: '',
                postalCode: '',
                state: '',
            });

            expect(await getInvalidFields(form)).toEqual(fields);
        });
    });

    describe('submit', () => {
        it('clears the VAT number when the field is emptied', async () => {
            const { form, onSubmit } = mountForm();
            form.updateInitialState(organization);
            form.form.value.companyVatNumber = '';

            await form.submit('cus_123');

            expect(onSubmit).toHaveBeenCalledWith({
                customerId: 'cus_123',
                payload: expect.objectContaining({
                    organization: expect.objectContaining({ tax_ids: [] }),
                }),
            });
        });

        it('resolves with what the update resolved with', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);

            await expect(form.submit('cus_123')).resolves.toBe(organization);
        });
    });
});
