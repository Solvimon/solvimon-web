import { flushPromises, mount } from '@vue/test-utils';
import type { Customer } from '@solvimon/solvimon-types';
import BillingInformationForm from './BillingInformationForm.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock();
});

type StoredTaxId = {
    id: string;
    type?: string | null;
    display_name?: string;
    tax_id_validation_result?: Record<string, unknown>;
};

const organization = (taxIds: StoredTaxId[] | undefined, country = 'NL') =>
    ({
        id: 'cus_123',
        email: 'billing@example.com',
        type: 'ORGANIZATION',
        organization: {
            legal_name: 'Acme',
            ...(taxIds && { tax_ids: taxIds }),
            registered_address: {
                line1: 'Main street 1',
                postal_code: '12345',
                city: 'Somewhere',
                state: 'ON',
                country,
            },
        },
    }) as unknown as Customer;

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

/**
 * Answers like the API: a PATCH merges into the stored customer, and `tax_ids`, when sent, replaces
 * the whole list. The parent passes the saved customer back down, as the entry does.
 */
const mountForm = (initial: Customer) => {
    let stored = structuredClone(initial);
    const payloads: Partial<Customer>[] = [];

    const updateCustomer = vi.fn(async ({ payload }: { payload: Partial<Customer> }) => {
        payloads.push(structuredClone(payload));
        const current = stored as unknown as Record<string, Record<string, unknown>>;
        const sent = payload as unknown as Record<string, Record<string, unknown>>;
        stored = {
            ...current,
            ...sent,
            ...(sent.organization && {
                organization: { ...current.organization, ...sent.organization },
            }),
        } as unknown as Customer;
        await wrapper.setProps({ customer: stored });
        return stored;
    });

    const wrapper = mount(BillingInformationForm, {
        props: { customer: initial, isLoading: false, updateCustomer },
    });

    const input = (name: string) => wrapper.find(`input[name="${name}"]`);

    return {
        wrapper,
        updateCustomer,
        payloads,
        stored: () => stored,
        email: () => wrapper.find('input[type="email"]'),
        vat: () => input('vat_number'),
        save: async () => {
            await wrapper.find('form').trigger('submit');
            await flushPromises();
        },
    };
};

const sentTaxIds = (payload: Partial<Customer> | undefined) =>
    payload && 'organization' in payload ? payload.organization?.tax_ids : undefined;
const hasTaxIds = (payload: Partial<Customer> | undefined) =>
    !!payload && 'organization' in payload && 'tax_ids' in (payload.organization ?? {});

describe('BillingInformationForm tax ids (tester, round 2)', () => {
    describe('what counts as editing the VAT number', () => {
        it('ignores whitespace around the stored number', async () => {
            const form = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await form.vat().setValue('  NL123456789B01 ');
            await form.email().setValue('edited@example.com');
            await form.save();

            expect(form.updateCustomer).toHaveBeenCalledOnce();
            expect(hasTaxIds(form.payloads[0])).toBe(false);
        });

        it('sends nothing for an edit that was reverted', async () => {
            const form = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await form.vat().setValue('DE123456789');
            await form.vat().setValue('NL123456789B01');
            await form.email().setValue('edited@example.com');
            await form.save();

            expect(hasTaxIds(form.payloads[0])).toBe(false);
        });

        it('judges a case-only change of an EU number as an edit', async () => {
            const form = mountForm(
                organization([{ id: 'NL123456789B01', type: 'GENERIC_TAX_ID' }]),
            );

            await form.vat().setValue('nl123456789b01');
            await form.save();

            // The format rule is case-sensitive, so this is refused rather than sent.
            expect(form.updateCustomer).not.toHaveBeenCalled();
        });

        it('still refuses a malformed number typed over a stored non-EU id', async () => {
            const form = mountForm(
                organization([{ id: '123456789RT0001', type: 'CA_GST_HST' }], 'CA'),
            );

            await form.vat().setValue('NL123');
            await form.save();

            expect(form.updateCustomer).not.toHaveBeenCalled();
        });

        // DEFECT (limitation of the shared EU-only `taxId` rule): a Canadian customer cannot
        // correct a stored GST/HST number to another well-formed GST/HST number.
        it.fails('lets a Canadian customer change a stored GST/HST number', async () => {
            const form = mountForm(
                organization([{ id: '123456789RT0001', type: 'CA_GST_HST' }], 'CA'),
            );

            await form.vat().setValue('987654321RT0001');
            await form.save();

            expect(form.updateCustomer).toHaveBeenCalledOnce();
        });
    });

    describe('the tax ids sent', () => {
        it('sends no tax ids for an email-only save of a Canadian organisation', async () => {
            const form = mountForm(
                organization([{ id: '123456789RT0001', type: 'CA_GST_HST' }], 'CA'),
            );

            await form.email().setValue('edited@example.com');
            await form.save();

            expect(form.updateCustomer).toHaveBeenCalledOnce();
            expect(hasTaxIds(form.payloads[0])).toBe(false);
        });

        it('never sends tax ids for an individual', async () => {
            const form = mountForm(individual);

            await form.email().setValue('edited@example.com');
            await form.save();

            expect(form.payloads[0]).not.toHaveProperty('organization');
            expect(JSON.stringify(form.payloads[0])).not.toContain('tax_ids');
        });

        it('sends nothing for an organisation without tax ids until one is typed', async () => {
            const form = mountForm(organization(undefined));

            await form.email().setValue('edited@example.com');
            await form.save();
            expect(hasTaxIds(form.payloads[0])).toBe(false);

            await form.vat().setValue('NL123456789B01');
            await form.save();
            expect(sentTaxIds(form.payloads[1])).toEqual([
                { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
            ]);
        });

        it('keeps the order and the other ids when the first is edited, without the validation result', async () => {
            const form = mountForm(
                organization([
                    {
                        id: 'NL123456789B01',
                        type: 'GENERIC_TAX_ID',
                        display_name: 'VAT',
                        tax_id_validation_result: { valid: 'VALID', id: 'x' },
                    },
                    { id: '123456789RT0001', type: 'CA_GST_HST', display_name: 'GST/HST' },
                    { id: '51824753556', type: 'AU_GST' },
                ]),
            );

            await form.vat().setValue('DE123456789');
            await form.save();

            expect(sentTaxIds(form.payloads[0])).toEqual([
                { id: 'DE123456789', type: 'GENERIC_TAX_ID', display_name: 'VAT' },
                { id: '123456789RT0001', type: 'CA_GST_HST', display_name: 'GST/HST' },
                { id: '51824753556', type: 'AU_GST' },
            ]);
        });

        it('uses the saved list for the next save after the customer is reloaded', async () => {
            const form = mountForm(
                organization([
                    { id: 'NL123456789B01', type: 'GENERIC_TAX_ID' },
                    { id: '51824753556', type: 'AU_GST' },
                ]),
            );

            await form.vat().setValue('DE123456789');
            await form.save();
            expect((form.vat().element as HTMLInputElement).value).toBe('DE123456789');

            await form.email().setValue('edited@example.com');
            await form.save();
            expect(hasTaxIds(form.payloads[1])).toBe(false);

            await form.vat().setValue('');
            await form.save();
            expect(sentTaxIds(form.payloads[2])).toEqual([{ id: '51824753556', type: 'AU_GST' }]);
        });
    });
});
