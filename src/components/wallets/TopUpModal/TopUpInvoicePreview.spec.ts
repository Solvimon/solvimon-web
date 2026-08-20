import type { Invoice } from '@solvimon/solvimon-types';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import TopUpInvoicePreview from './TopUpInvoicePreview.vue';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPreview } = vi.hoisted(() => ({ mockPreview: vi.fn() }));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ previewChargeOnDemandPricingItems: mockPreview }),
}));

// The real Skeleton is kept, so what stands in for the preview while it loads is exercised. Only the
// preview itself is stubbed: it renders a whole invoice, none of which this component drives.
vi.mock('@solvimon/solvimon-ui', async () => {
    const { createSolvimonUiMock } = await import('@/test-utils/solvimonUiMock');
    return createSolvimonUiMock({
        InvoicePreview: defineComponent({
            name: 'InvoicePreviewStub',
            props: ['invoice', 'isCustomerFacing'],
            template: '<div data-testid="invoice-preview" />',
        }),
    });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INVOICE = { id: 'inv_1' } as Invoice;

const PRICING_ITEMS = [
    { pricing_item_id: 'prii_1', flexible_amount: { quantity: '25.00', currency: 'EUR' } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mountPreview = (props: Record<string, unknown> = {}) =>
    mount(TopUpInvoicePreview, {
        props: { pricingPlanScheduleId: 'ppsc_1', pricingItems: PRICING_ITEMS, ...props },
    });

const skeleton = (wrapper: ReturnType<typeof mountPreview>) =>
    wrapper.find('[data-testid="top-up-invoice-preview-skeleton"]');

const preview = (wrapper: ReturnType<typeof mountPreview>) =>
    wrapper.find('[data-testid="invoice-preview"]');

// ─── Specs ────────────────────────────────────────────────────────────────────

describe('TopUpInvoicePreview', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockPreview.mockReset();
        mockPreview.mockResolvedValue(INVOICE);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('prices what is being charged on the schedule it is billed on', async () => {
        mountPreview();
        await vi.runAllTimersAsync();

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: PRICING_ITEMS,
        });
    });

    it('shows the preview once it lands, under what it is', async () => {
        const wrapper = mountPreview();
        await vi.runAllTimersAsync();

        expect(preview(wrapper).exists()).toBe(true);
        expect(wrapper.text()).toContain('You will pay');
        expect(wrapper.findComponent({ name: 'InvoicePreviewStub' }).props('invoice')).toEqual(
            INVOICE,
        );
    });

    // Holding the height a preview needs is what stops the modal jumping as the request lands.
    it('holds the height a preview will need while the request is out', () => {
        mockPreview.mockReturnValue(new Promise(() => {}));
        const wrapper = mountPreview();

        expect(skeleton(wrapper).classes()).toContain('h-[152px]');
        expect(preview(wrapper).exists()).toBe(false);
    });

    it('steps aside once the preview has something to show', async () => {
        const wrapper = mountPreview();
        await vi.runAllTimersAsync();

        expect(skeleton(wrapper).exists()).toBe(false);
    });

    // A top-up with no amount entered yet has nothing to price — but the total is still going to land
    // here, so the space it needs is held rather than opening up under the customer once it does.
    it('holds the space while there is nothing to charge, without asking for anything', async () => {
        const wrapper = mountPreview({ pricingItems: undefined });
        await vi.runAllTimersAsync();

        expect(mockPreview).not.toHaveBeenCalled();
        expect(skeleton(wrapper).exists()).toBe(true);
        expect(preview(wrapper).exists()).toBe(false);
    });

    it('reprices as what is being charged changes', async () => {
        const wrapper = mountPreview();
        await vi.runAllTimersAsync();

        await wrapper.setProps({
            pricingItems: [
                {
                    pricing_item_id: 'prii_1',
                    flexible_amount: { quantity: '50.00', currency: 'EUR' },
                },
            ],
        });
        await vi.runAllTimersAsync();

        expect(mockPreview).toHaveBeenLastCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [
                {
                    pricing_item_id: 'prii_1',
                    flexible_amount: { quantity: '50.00', currency: 'EUR' },
                },
            ],
        });
    });
});
