import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceBlock from './InvoiceBlock.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        InvoiceSummary: defineComponent({
            name: 'InvoiceSummaryStub',
            props: { invoice: { type: Object, required: true } },
            setup: (props) => () => h('div', { class: 'invoice-summary-stub' }),
        }),
    });
});

describe('InvoiceBlock', () => {
    const invoice = {
        id: 'inv_1',
        timezone: 'UTC',
        customer: { id: 'cus_1', name: 'Ada', timezone: 'Europe/Amsterdam' },
        periods: [],
    } as unknown as Invoice;

    it("has the summary date the invoice's lines in the invoice's own timezone", () => {
        const wrapper = mount(InvoiceBlock, { props: { invoice } });

        const passed = wrapper.getComponent({ name: 'InvoiceSummaryStub' }).props('invoice');
        expect(passed.customer).toEqual({ id: 'cus_1', name: 'Ada', timezone: 'UTC' });
        expect(invoice.customer.timezone).toBe('Europe/Amsterdam');
    });
});
