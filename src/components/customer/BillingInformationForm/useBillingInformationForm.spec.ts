import type { Customer } from '@solvimon/solvimon-types';
import { useBillingInformationForm } from './useBillingInformationForm';
import type { BillingInformationFormState } from './BillingInformationForm.types';

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

const organization = {
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

            updateInitialState(organization);

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

        it('takes the first of several tax ids as the VAT number', () => {
            const { form, updateInitialState } = setup();

            updateInitialState({
                ...organization,
                organization: {
                    legal_name: 'Acme B.V.',
                    tax_ids: [
                        { id: 'NL123456789B01', type: 'EU_VAT' },
                        { id: 'GB987654321', type: 'GB_VAT' },
                    ],
                },
            } as Customer);

            expect(form.value.companyVatNumber).toBe('NL123456789B01');
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

    describe('changes', () => {
        it('reports a field the user cleared as null, not as an empty string', () => {
            const { form, updateInitialState, changes } = setup();

            updateInitialState(individual);
            form.value = { ...form.value, addressLine2: '' };

            expect(changes.value).toEqual({ addressLine2: null });
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

        it('accepts a valid email', async () => {
            const { validation } = setup({ email: 'jane@example.com' });

            expect(await validation.value.$validate()).toBe(true);
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

        it('sends an organization with its VAT number as a generic tax id', async () => {
            const { submit, updateInitialState, onSubmit } = setup();
            updateInitialState(organization);

            await submit('cus_org');

            expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
                customerId: 'cus_org',
                payload: {
                    type: 'ORGANIZATION',
                    email: 'billing@acme.example',
                    organization: {
                        legal_name: 'Acme B.V.',
                        tax_ids: [{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }],
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

        it('returns what the submit handler resolves with', async () => {
            const customer = { id: 'cus_1' };
            const { submit } = useBillingInformationForm({
                onSubmit: () => Promise.resolve(customer),
            });

            await expect(submit('cus_1')).resolves.toBe(customer);
        });
    });
});
