import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceOrderSummary from './InvoiceOrderSummary.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // Resolves its own IntlProvider, which is not mounted here.
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: { invoice: { type: Object, required: true }, isPaid: Boolean },
            setup: (props) => () =>
                h('div', { class: 'sv-invoice-preview-stub' }, String(props.invoice.id)),
        }),
        InvoicePreviewGroups: defineComponent({
            name: 'InvoicePreviewGroupsStub',
            setup: () => () => h('div'),
        }),
        Amount: defineComponent({
            name: 'AmountStub',
            props: { value: { type: Object, required: true } },
            setup: (props) => () => h('span', `${props.value.currency} ${props.value.quantity}`),
        }),
    });
});

// Provides a nested IntlProvider, which reaches for an ErrorHandlingProvider that only the real
// provider tree has. What it overrides is asserted through the props it is given.
vi.mock('@/components/providers/TranslationProvider/TranslationOverride.vue', () => ({
    default: defineComponent({
        name: 'TranslationOverrideStub',
        props: { messages: { type: Object, required: true } },
        setup:
            (_props, { slots }) =>
            () =>
                h('div', {}, slots.default?.()),
    }),
}));

const anInvoice = (overrides: Partial<Invoice> = {}) =>
    ({
        id: 'invo_1',
        invoice_number: 'INV-2026-001',
        due_date: '2026-01-15T00:00:00Z',
        billing_currency: 'EUR',
        customer: { timezone: 'Europe/Amsterdam' },
        periods: [],
        tax_summary: { total_amount: { quantity: '75.00', currency: 'EUR' } },
        open_invoice_amount: { quantity: '75.00', currency: 'EUR' },
        ...overrides,
    }) as unknown as Invoice;

describe('InvoiceOrderSummary', () => {
    it('heads the summary with the invoice and its due date', () => {
        const wrapper = mount(InvoiceOrderSummary, { props: { invoice: anInvoice() } });

        expect(wrapper.text()).toContain('Invoice summary');
        expect(wrapper.text()).toContain('Invoice INV-2026-001');
        expect(wrapper.find('.sv-invoice-order-summary__due-date').text()).toContain('Due on');
    });

    it('prices the invoice as the checkout prices an order, with its total named as such', () => {
        const wrapper = mount(InvoiceOrderSummary, { props: { invoice: anInvoice() } });

        expect(wrapper.find('.sv-invoice-preview-stub').text()).toBe('invo_1');
        expect(
            wrapper.findComponent({ name: 'TranslationOverrideStub' }).props('messages'),
        ).toEqual({ 'invoice_preview.total_due_today_heading': 'Total' });
    });

    it('says nothing of an earlier payment on an invoice that is open in full', () => {
        const wrapper = mount(InvoiceOrderSummary, { props: { invoice: anInvoice() } });

        expect(wrapper.find('.sv-invoice-order-summary__due').exists()).toBe(false);
    });

    it('shows what has been paid already and what is still due on a partly paid invoice', () => {
        const wrapper = mount(InvoiceOrderSummary, {
            props: {
                invoice: anInvoice({
                    open_invoice_amount: { quantity: '25.00', currency: 'EUR' },
                }),
            },
        });

        expect(wrapper.find('.sv-invoice-order-summary__paid').text()).toContain('EUR 50.00');
        expect(wrapper.find('.sv-invoice-order-summary__due').text()).toContain('EUR 25.00');
    });

    it.each([
        ['once it is paid', { isPaid: true }],
        [
            'when the invoice says it is paid',
            {
                invoice: anInvoice({
                    paid: true,
                    open_invoice_amount: { quantity: '0.00', currency: 'EUR' },
                }),
            },
        ],
    ])('leaves out what is already paid and still due %s', (_, props) => {
        const wrapper = mount(InvoiceOrderSummary, {
            props: {
                invoice: anInvoice({ open_invoice_amount: { quantity: '25.00', currency: 'EUR' } }),
                ...props,
            },
        });

        expect(wrapper.find('.sv-invoice-order-summary__paid').exists()).toBe(false);
        expect(wrapper.find('.sv-invoice-order-summary__due').exists()).toBe(false);
    });

    it('works out what is already paid on a credit note', () => {
        const wrapper = mount(InvoiceOrderSummary, {
            props: {
                invoice: anInvoice({
                    tax_summary: { total_amount: { quantity: '-50.00', currency: 'EUR' } },
                    open_invoice_amount: { quantity: '-25.00', currency: 'EUR' },
                } as Partial<Invoice>),
            },
        });

        expect(wrapper.find('.sv-invoice-order-summary__paid').text()).toContain('EUR -25.00');
        expect(wrapper.find('.sv-invoice-order-summary__due').text()).toContain('EUR -25.00');
    });
});
