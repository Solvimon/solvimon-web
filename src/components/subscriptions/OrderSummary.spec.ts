import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import OrderSummary from './OrderSummary.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    const { mockUseIntl } = await import('@/test-utils/useIntlMock');
    return createSolvimonUiMock({
        // Grouped as a customer's locale would, which the shared mock leaves out.
        useIntl: () => ({
            ...mockUseIntl(),
            formatNumber: (value: number) => new Intl.NumberFormat('en-US').format(value),
        }),
        // Resolves its own IntlProvider, which is not mounted here.
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            setup: () => () => h('div', { class: 'sv-invoice-preview-stub' }),
        }),
        InvoicePreviewGroups: defineComponent({
            name: 'InvoicePreviewGroupsStub',
            setup: () => () => h('div'),
        }),
    });
});

const subscription = {
    id: 'ppsu_1',
    name: 'Pro',
    billing_period: { type: 'MONTH', value: 1 },
    billing_currency: 'EUR',
    pricing_plan_schedule_infos: [],
} as unknown as PricingPlanSubscriptionExpanded;

const line = (pricingItemConfigId: string, number?: string) => ({
    type: 'REVENUE',
    pricing_item_config_id: pricingItemConfigId,
    details: number ? { meter_value: { number } } : {},
});
const group = (name: string, ...lines: ReturnType<typeof line>[]) => ({
    type: 'REVENUE',
    pricing: { name },
    amount_excluding_tax: { quantity: '1.00', currency: 'EUR' },
    lines,
});
const invoiceOf = (...groups: ReturnType<typeof group>[]) =>
    ({
        id: 'invo_1',
        billing_currency: 'EUR',
        lines: [],
        periods: [{ groups }],
    }) as unknown as Invoice;

const mountSummary = (invoice: Invoice) =>
    mount(OrderSummary, {
        props: { subscription, invoice, countryCode: 'NL' },
        global: { stubs: { SubscriptionSummary: true } },
    });
const countsOf = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('.sv-order-summary__quantity').map((count) => ({
        text: count.text(),
        style: count.attributes('style'),
    }));

describe('OrderSummary', () => {
    it('lists every line of the invoice in one card', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Staff seats', line('pico_seats', '5')),
            ),
        );

        const cards = wrapper.findAll('.sv-order-summary__lines');
        expect(cards).toHaveLength(1);
        expect(cards[0].text()).toContain('Platform');
        expect(cards[0].text()).toContain('Staff seats');
    });

    it('starts each line with how many it charges, in a column as wide as the widest', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Staff seats', line('pico_seats', '1'), line('pico_seats', '11')),
                group('Bundle', line('pico_a'), line('pico_b', '3')),
            ),
        );

        // A line of several prices shows no count, but keeps the column so its name lines up.
        expect(countsOf(wrapper)).toEqual([
            { text: '1', style: 'min-width: 2ch;' },
            { text: '12', style: 'min-width: 2ch;' },
            { text: '', style: 'min-width: 2ch;' },
        ]);
    });

    it('shortens a large count and keeps the whole number for its tooltip', () => {
        const wrapper = mountSummary(
            invoiceOf(
                group('Platform', line('pico_fee')),
                group('Records', line('pico_records', '13182678')),
            ),
        );

        expect(countsOf(wrapper)).toEqual([
            { text: '1', style: 'min-width: 4ch;' },
            { text: '13M+', style: 'min-width: 4ch;' },
        ]);
        const tooltips = wrapper.findAllComponents({ name: 'Tooltip' });
        expect(tooltips).toHaveLength(1);
        expect(tooltips[0].text()).toContain('13M+');
    });
});
