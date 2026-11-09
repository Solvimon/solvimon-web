import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import OrderSummary from './OrderSummary.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
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

const invoice = {
    id: 'invo_1',
    billing_currency: 'EUR',
    periods: [],
    lines: [],
} as unknown as Invoice;

const mountSummary = (isUpdating?: boolean) =>
    mount(OrderSummary, {
        props: { subscription, invoice, countryCode: 'NL', isUpdating },
        global: { stubs: { SubscriptionSummary: true } },
    });

describe('OrderSummary', () => {
    it('says the price is being updated and marks the invoice busy while a change is priced', () => {
        const wrapper = mountSummary(true);

        expect(wrapper.find('.sv-order-summary__updating[role="status"]').exists()).toBe(true);
        const totals = wrapper.find('.sv-order-summary__totals');
        expect(totals.attributes('aria-busy')).toBe('true');
        expect(totals.classes()).toContain('blur');
    });

    it('shows the invoice as current when nothing is being priced', () => {
        const wrapper = mountSummary();

        expect(wrapper.find('.sv-order-summary__updating').exists()).toBe(false);
        const totals = wrapper.find('.sv-order-summary__totals');
        expect(totals.attributes('aria-busy')).not.toBe('true');
        expect(totals.classes()).not.toContain('blur');
        expect(totals.classes()).toContain('transition');
    });
});
