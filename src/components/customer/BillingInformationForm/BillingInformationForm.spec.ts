import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import type { Customer, FormFieldError } from '@solvimon/solvimon-types';
import BillingInformationForm from './BillingInformationForm.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        CountrySelect: defineComponent({
            name: 'CountrySelectStub',
            props: { singleModelValue: String, label: String, error: [String, Array] },
            emits: ['update:singleModelValue'],
            template: `<input data-testid="country" :value="singleModelValue"
                @input="$emit('update:singleModelValue', $event.target.value)" />`,
        }),
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            template: '<div role="alert">{{ title }}</div>',
        }),
    });
});

const individual = {
    id: 'cus_123',
    email: 'billing@example.com',
    type: 'INDIVIDUAL',
    individual: {
        name: { first_name: 'John', last_name: 'Doe' },
        residential_address: {
            line1: 'Main street 1',
            postal_code: '1000AA',
            city: 'Amsterdam',
            country: 'NL',
        },
    },
} as unknown as Customer;

const organization = (taxIds: { id: string; type: string }[], country = 'NL') =>
    ({
        id: 'cus_123',
        email: 'billing@example.com',
        type: 'ORGANIZATION',
        organization: {
            legal_name: 'Acme',
            tax_ids: taxIds,
            registered_address: {
                line1: 'Main street 1',
                postal_code: '12345',
                city: 'Somewhere',
                state: 'ON',
                country,
            },
        },
    }) as unknown as Customer;

const mountForm = (customer: Customer, apiError?: FormFieldError) => {
    const updateCustomer = vi.fn(({ payload }: { payload: Partial<Customer> }) =>
        Promise.resolve({ ...customer, ...payload } as Customer),
    );

    const wrapper = mount(BillingInformationForm, {
        props: { customer, isLoading: false, updateCustomer, apiError },
    });

    return { wrapper, updateCustomer };
};

const emailInput = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
    wrapper.find('input[type="email"]');
const saveButton = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
    wrapper.find('button[type="submit"]');
const submit = async (wrapper: ReturnType<typeof mountForm>['wrapper']) => {
    await wrapper.find('form').trigger('submit');
    await flushPromises();
};

describe('BillingInformationForm (tester)', () => {
    describe('a new customer from the parent', () => {
        it('keeps unsaved edits when the parent passes an equal customer object', async () => {
            const { wrapper } = mountForm(individual);

            await emailInput(wrapper).setValue('edited@example.com');
            await wrapper.setProps({ customer: structuredClone(individual) });

            expect((emailInput(wrapper).element as HTMLInputElement).value).toBe(
                'edited@example.com',
            );
            expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();
        });

        it('shows a changed customer when there are no unsaved edits', async () => {
            const { wrapper } = mountForm(individual);

            await wrapper.setProps({ customer: { ...individual, email: 'new@example.com' } });

            expect((emailInput(wrapper).element as HTMLInputElement).value).toBe('new@example.com');
        });
    });

    describe('country rules', () => {
        it('does not save a US address without line 1 and postal code', async () => {
            const { wrapper, updateCustomer } = mountForm(individual);

            await wrapper.find('[data-testid="country"]').setValue('US');
            await wrapper.find('input[name="address_line_1"]').setValue('');
            await wrapper.find('input[name="postal_code"]').setValue('');
            await submit(wrapper);

            expect(updateCustomer).not.toHaveBeenCalled();
        });

        it('does not save a Canadian address without a state', async () => {
            const { wrapper, updateCustomer } = mountForm(individual);

            await wrapper.find('[data-testid="country"]').setValue('CA');
            await submit(wrapper);

            expect(updateCustomer).not.toHaveBeenCalled();
        });

        it('saves a Canadian address once the state is filled in', async () => {
            const { wrapper, updateCustomer } = mountForm(individual);

            await wrapper.find('[data-testid="country"]').setValue('CA');
            await wrapper.find('input[name="state"]').setValue('ON');
            await submit(wrapper);

            expect(updateCustomer).toHaveBeenCalledOnce();
        });
    });

    describe('organisations', () => {
        it('does not save without a legal name', async () => {
            const { wrapper, updateCustomer } = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await wrapper.find('input[name="legal_name"]').setValue('');
            await submit(wrapper);

            expect(updateCustomer).not.toHaveBeenCalled();
        });

        it('does not save VAT number NL123', async () => {
            const { wrapper, updateCustomer } = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await wrapper.find('input[name="vat_number"]').setValue('NL123');
            await submit(wrapper);

            expect(updateCustomer).not.toHaveBeenCalled();
        });

        it('shows the emptied VAT number as saved after the API accepts it', async () => {
            const { wrapper, updateCustomer } = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await wrapper.find('input[name="vat_number"]').setValue('');
            await submit(wrapper);

            expect(updateCustomer.mock.calls[0][0].payload).toMatchObject({
                organization: { tax_ids: [] },
            });
            expect(
                (wrapper.find('input[name="vat_number"]').element as HTMLInputElement).value,
            ).toBe('');
            expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
        });

        it.each(['NL', 'CA', 'US'])(
            'saves an email change for a %s customer with a stored EU VAT number',
            async (country) => {
                const { wrapper, updateCustomer } = mountForm(
                    organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }], country),
                );

                await emailInput(wrapper).setValue('edited@example.com');
                await submit(wrapper);

                expect(updateCustomer).toHaveBeenCalledOnce();
            },
        );

        it('names the stored tax id as the reason a save is refused', async () => {
            const { wrapper, updateCustomer } = mountForm(
                organization([{ id: '123456789RT0001', type: 'CA_GST_HST' }], 'CA'),
            );

            await emailInput(wrapper).setValue('edited@example.com');
            await submit(wrapper);

            expect(updateCustomer).not.toHaveBeenCalled();
            expect(wrapper.text()).toContain('Invalid tax ID');
        });

        // DEFECT: the `taxId` rule only knows EU/UK/CH/NO formats, but the API stores CA, AU
        // and generic tax ids too. A customer with one cannot save anything, not even an email.
        it.fails.each([
            ['CA', { id: '123456789RT0001', type: 'CA_GST_HST' }],
            ['AU', { id: '51824753556', type: 'AU_GST' }],
            ['US', { id: '12-3456789', type: 'GENERIC_TAX_ID' }],
        ])(
            'saves an email change for a %s customer with a stored tax id',
            async (country, taxIdEntry) => {
                const { wrapper, updateCustomer } = mountForm(organization([taxIdEntry], country));

                await emailInput(wrapper).setValue('edited@example.com');
                await submit(wrapper);

                expect(updateCustomer).toHaveBeenCalledOnce();
            },
        );

        // DEFECT (pre-existing mapping, reachable now that Save works): every save replaces the
        // stored tax ids with the first id typed as GENERIC_TAX_ID, dropping the rest.
        it.fails('keeps the stored tax ids when only the email changes', async () => {
            const taxIds = [
                { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
                { id: 'DE123456789', type: 'GENERIC_TAX_ID' },
            ];
            const { wrapper, updateCustomer } = mountForm(organization(taxIds));

            await emailInput(wrapper).setValue('edited@example.com');
            await submit(wrapper);

            const { payload } = updateCustomer.mock.calls[0][0];
            const sent = 'organization' in payload ? payload.organization?.tax_ids : undefined;
            expect(sent === undefined || sent.length === taxIds.length).toBe(true);
        });
    });

    describe('API errors', () => {
        it('shows a tax id error on the VAT field', () => {
            const { wrapper } = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
                { 'organization.tax_ids[0].id': 'Tax id is invalid' },
            );

            expect(wrapper.find('[role="alert"]').exists()).toBe(false);
            expect(wrapper.text()).toContain('Tax id is invalid');
        });

        it('shows a first name error for an individual', () => {
            const { wrapper } = mountForm(individual, {
                'individual.name.first_name': 'First name is required',
            });

            expect(wrapper.find('[role="alert"]').exists()).toBe(false);
            expect(wrapper.text()).toContain('First name is required');
        });

        it('shows a generic error in the notification', () => {
            const { wrapper } = mountForm(individual, { _generic: 'Internal server error' });

            expect(wrapper.find('[role="alert"]').text()).toBe('Internal server error');
        });

        it('renders an API message as text, not markup', () => {
            const { wrapper } = mountForm(individual, {
                email: '<img src="x" onerror="alert(1)">',
            });

            expect(wrapper.find('img').exists()).toBe(false);
            expect(wrapper.text()).toContain('<img src="x"');
        });
    });

    describe('submitting', () => {
        it('sends one PATCH while the first is still pending, and allows the next one after', async () => {
            let resolve: (customer: Customer) => void = () => {};
            const updateCustomer = vi.fn(() => new Promise<Customer>((done) => (resolve = done)));
            const wrapper = mount(BillingInformationForm, {
                props: { customer: individual, isLoading: false, updateCustomer },
            });

            await emailInput(wrapper).setValue('edited@example.com');
            await wrapper.find('form').trigger('submit');
            await flushPromises();
            await wrapper.find('form').trigger('submit');
            await flushPromises();

            expect(updateCustomer).toHaveBeenCalledOnce();

            resolve({ ...individual, email: 'edited@example.com' } as Customer);
            await flushPromises();
            await emailInput(wrapper).setValue('again@example.com');
            await submit(wrapper);

            expect(updateCustomer).toHaveBeenCalledTimes(2);
        });
    });
});
