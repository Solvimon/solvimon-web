import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import type { Customer } from '@solvimon/solvimon-types';
import { useBillingInformationForm } from './useBillingInformationForm';
import type { BillingInformationFormState } from './BillingInformationForm.types';

const organizationWith = (taxIds: { id: string; type: string; display_name?: string }[]) =>
    ({
        id: 'cus_123',
        type: 'ORGANIZATION',
        email: 'billing@example.com',
        organization: {
            legal_name: 'Acme B.V.',
            tax_ids: taxIds,
            registered_address: { line1: 'Main street 1', city: 'Amsterdam', country: 'NL' },
        },
    }) as unknown as Customer;

const organization = organizationWith([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]);

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

const individual = {
    id: 'cus_individual',
    type: 'INDIVIDUAL',
    email: 'jane@example.com',
    individual: {
        name: { first_name: 'Jane', last_name: 'Doe' },
        residential_address: {
            line1: 'Main street 1',
            line2: 'Floor 2',
            postal_code: '1000AA',
            city: 'Amsterdam',
            country: 'NL',
            state: 'NH',
        },
    },
} as unknown as Customer;

const organizationWithAddress = {
    id: 'cus_org',
    type: 'ORGANIZATION',
    email: 'billing@acme.example',
    organization: {
        legal_name: 'Acme B.V.',
        tax_ids: [{ id: 'NL123456789B01', type: 'EU_VAT' }],
        registered_address: {
            line1: 'Dam 1',
            postal_code: '1012JS',
            city: 'Amsterdam',
            country: 'NL',
        },
    },
} as unknown as Customer;

const setup = (initialState?: Partial<BillingInformationFormState>) => {
    const onSubmit = vi.fn(() => Promise.resolve());
    return { ...useBillingInformationForm({ initialState, onSubmit }), onSubmit };
};

describe('useBillingInformationForm', () => {
    describe('initial state', () => {
        it('starts as an empty individual', () => {
            const { form, hasChanges } = setup();

            expect(form.value).toEqual({
                type: 'INDIVIDUAL',
                email: '',
                country: '',
                addressLine1: '',
                postalCode: '',
                city: '',
                state: '',
            });
            expect(hasChanges.value).toBe(false);
        });

        it('layers the given initial state over the defaults', () => {
            const { form } = setup({ type: 'ORGANIZATION', country: 'DE' });

            expect(form.value).toMatchObject({ type: 'ORGANIZATION', country: 'DE', email: '' });
        });
    });

    describe('updateInitialState', () => {
        it('fills the form from an individual customer', () => {
            const { form, updateInitialState, hasChanges } = setup();

            updateInitialState(individual);

            expect(form.value).toEqual({
                type: 'INDIVIDUAL',
                email: 'jane@example.com',
                country: 'NL',
                addressLine1: 'Main street 1',
                addressLine2: 'Floor 2',
                postalCode: '1000AA',
                city: 'Amsterdam',
                state: 'NH',
                firstName: 'Jane',
                lastName: 'Doe',
            });
            expect(hasChanges.value).toBe(false);
        });

        it('fills the form from an organization, taking its first tax id as the VAT number', () => {
            const { form, updateInitialState } = setup();

            updateInitialState(organizationWithAddress);

            expect(form.value).toEqual({
                type: 'ORGANIZATION',
                email: 'billing@acme.example',
                country: 'NL',
                addressLine1: 'Dam 1',
                addressLine2: '',
                postalCode: '1012JS',
                city: 'Amsterdam',
                state: '',
                companyLegalName: 'Acme B.V.',
                companyVatNumber: 'NL123456789B01',
            });
        });

        it('uses empty strings for whatever the customer is missing', () => {
            const { form, updateInitialState } = setup();

            updateInitialState({ id: 'cus_bare', type: 'INDIVIDUAL', individual: {} } as Customer);

            expect(form.value).toEqual({
                type: 'INDIVIDUAL',
                email: '',
                country: '',
                addressLine1: '',
                addressLine2: '',
                postalCode: '',
                city: '',
                state: '',
                firstName: '',
                lastName: '',
            });
        });

        it('exposes the loaded customer as the state edits are compared against', () => {
            const { form, updateInitialState, initialState, hasChanges, changes } = setup();

            updateInitialState(individual);
            form.value = { ...form.value, city: 'Utrecht' };

            expect(initialState.value.city).toBe('Amsterdam');
            expect(hasChanges.value).toBe(true);
            expect(changes.value).toEqual({ city: 'Utrecht' });
        });
    });

    describe('validation', () => {
        it('requires an email', async () => {
            const { validation } = setup();

            expect(await validation.value.$validate()).toBe(false);
            expect(validation.value.email.required.$invalid).toBe(true);
        });

        it('rejects an email that is not an address', async () => {
            const { validation } = setup({ email: 'not-an-email' });

            expect(await validation.value.$validate()).toBe(false);
            expect(validation.value.email.email.$invalid).toBe(true);
        });

        it('accepts a valid email once the country is given', async () => {
            const { validation } = setup({ email: 'jane@example.com', country: 'NL' });

            expect(await validation.value.$validate()).toBe(true);
        });

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

        it('does not judge a stored tax id the format rule does not know', async () => {
            const { form } = mountForm();
            form.updateInitialState(
                organizationWith([{ id: '123456789RT0001', type: 'CA_GST_HST' }]),
            );

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
        it('sends an individual as a residential address and name', async () => {
            const { submit, updateInitialState, onSubmit } = setup();
            updateInitialState(individual);

            await submit('cus_individual');

            expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
                customerId: 'cus_individual',
                payload: {
                    type: 'INDIVIDUAL',
                    email: 'jane@example.com',
                    individual: {
                        name: { first_name: 'Jane', last_name: 'Doe' },
                        residential_address: {
                            line1: 'Main street 1',
                            line2: 'Floor 2',
                            postal_code: '1000AA',
                            city: 'Amsterdam',
                            country: 'NL',
                            state: 'NH',
                        },
                    },
                },
            });
        });

        it('sends an organization as a legal name and registered address', async () => {
            const { submit, updateInitialState, onSubmit } = setup();
            updateInitialState(organizationWithAddress);

            await submit('cus_org');

            expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
                customerId: 'cus_org',
                payload: {
                    type: 'ORGANIZATION',
                    email: 'billing@acme.example',
                    organization: {
                        legal_name: 'Acme B.V.',
                        registered_address: {
                            line1: 'Dam 1',
                            line2: '',
                            postal_code: '1012JS',
                            city: 'Amsterdam',
                            country: 'NL',
                            state: '',
                        },
                    },
                },
            });
        });

        it('leaves the tax ids out when the organization has no VAT number', async () => {
            const { submit, onSubmit } = setup({
                type: 'ORGANIZATION',
                companyLegalName: 'Acme B.V.',
                companyVatNumber: '',
            });

            await submit('cus_org');

            const [[{ payload }]] = onSubmit.mock.calls as unknown as [
                [{ payload: Partial<Customer> }],
            ];
            expect(payload).not.toHaveProperty('individual');
            expect(
                (payload as { organization: { tax_ids?: unknown } }).organization.tax_ids,
            ).toBeUndefined();
        });

        it('submits what the user typed rather than what was loaded', async () => {
            const { form, submit, updateInitialState, onSubmit } = setup();
            updateInitialState(individual);
            form.value = { ...form.value, email: 'new@example.com', city: 'Utrecht' };

            await submit('cus_individual');

            expect(onSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        email: 'new@example.com',
                        individual: expect.objectContaining({
                            residential_address: expect.objectContaining({ city: 'Utrecht' }),
                        }),
                    }),
                }),
            );
        });

        it('submits explicitly given data instead of the form', async () => {
            const { submit, onSubmit } = setup({ email: 'form@example.com' });

            await submit('cus_1', {
                type: 'INDIVIDUAL',
                email: 'given@example.com',
                country: 'BE',
                addressLine1: 'Grote Markt 1',
                postalCode: '1000',
                city: 'Brussels',
            });

            expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
                customerId: 'cus_1',
                payload: {
                    type: 'INDIVIDUAL',
                    email: 'given@example.com',
                    individual: {
                        name: { first_name: '', last_name: '' },
                        residential_address: {
                            line1: 'Grote Markt 1',
                            line2: '',
                            postal_code: '1000',
                            city: 'Brussels',
                            country: 'BE',
                            state: '',
                        },
                    },
                },
            });
        });

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

        const withTaxIds = organizationWith([
            { id: '123456789RT0001', type: 'CA_GST_HST', display_name: 'GST/HST' },
            { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
        ]);

        const sentTaxIds = (onSubmit: ReturnType<typeof vi.fn>) =>
            onSubmit.mock.calls[0][0].payload.organization.tax_ids;

        it('leaves the stored tax ids alone when the VAT number is not edited', async () => {
            const { form, onSubmit } = mountForm();
            form.updateInitialState(withTaxIds);
            form.form.value.email = 'edited@example.com';

            await form.submit('cus_123');

            expect(onSubmit.mock.calls[0][0].payload.organization).not.toHaveProperty('tax_ids');
        });

        it('edits the first tax id only, keeping its type and the others', async () => {
            const { form, onSubmit } = mountForm();
            form.updateInitialState(withTaxIds);
            form.form.value.companyVatNumber = '987654321RT0001';

            await form.submit('cus_123');

            expect(sentTaxIds(onSubmit)).toEqual([
                { id: '987654321RT0001', type: 'CA_GST_HST', display_name: 'GST/HST' },
                { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
            ]);
        });

        it('removes only the first tax id when the VAT number is emptied', async () => {
            const { form, onSubmit } = mountForm();
            form.updateInitialState(withTaxIds);
            form.form.value.companyVatNumber = '';

            await form.submit('cus_123');

            expect(sentTaxIds(onSubmit)).toEqual([
                { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
            ]);
        });

        it('adds a generic tax id where none was stored', async () => {
            const { form, onSubmit } = mountForm();
            form.updateInitialState(organizationWith([]));
            form.form.value.companyVatNumber = ' NL123456789B01 ';

            await form.submit('cus_123');

            expect(sentTaxIds(onSubmit)).toEqual([
                { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
            ]);
        });

        it('resolves with what the update resolved with', async () => {
            const { form } = mountForm();
            form.updateInitialState(organization);

            await expect(form.submit('cus_123')).resolves.toBe(organization);
        });
    });
});
