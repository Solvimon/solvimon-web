import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import type { Invoice } from '@solvimon/solvimon-types';
import SubscriptionManagementSummary from './SubscriptionManagementSummary.vue';

vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        // Both resolve their own IntlProvider, which is not mounted here.
        ErrorNotification: defineComponent({
            name: 'ErrorNotificationStub',
            props: { title: String },
            setup: (props) => () => h('div', { class: 'sv-error-notification-stub' }, props.title),
        }),
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: { invoice: { type: Object, required: true } },
            setup: (props) => () =>
                h('div', { class: 'sv-invoice-preview-stub' }, String(props.invoice.id)),
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

const invoice = { id: 'invo_1' } as unknown as Invoice;

const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(SubscriptionManagementSummary, { props });

describe('SubscriptionManagementSummary', () => {
    it('renders the previewed invoice', () => {
        const wrapper = mountComponent({ invoice });

        expect(wrapper.find('.sv-subscription-management-summary__invoice').exists()).toBe(true);
        expect(wrapper.text()).toContain('invo_1');
    });

    it('prompts for a choice before anything has been previewed', () => {
        const wrapper = mountComponent();

        expect(wrapper.find('.sv-subscription-management-summary__empty-state').exists()).toBe(
            true,
        );
        expect(wrapper.find('.sv-subscription-management-summary__invoice').exists()).toBe(false);
    });

    it('hides the previous invoice while a new preview is loading', () => {
        const wrapper = mountComponent({ invoice, isPending: true });

        expect(wrapper.find('.sv-subscription-management-summary__invoice').exists()).toBe(false);
        expect(wrapper.find('.sv-subscription-management-summary__empty-state').exists()).toBe(
            false,
        );
    });

    it('calls the total due rather than the shared preview’s "Total due today"', () => {
        const wrapper = mountComponent({ invoice });

        expect(
            wrapper.findComponent({ name: 'TranslationOverrideStub' }).props('messages'),
        ).toEqual({ 'invoice_preview.total_due_today_heading': 'Total due' });
    });

    it('reports a failed preview instead of a total', () => {
        const wrapper = mountComponent({ invoice, hasError: true });

        expect(wrapper.find('.sv-subscription-management-summary__error').exists()).toBe(true);
        expect(wrapper.find('.sv-subscription-management-summary__invoice').exists()).toBe(false);
    });
});
