import type { Amount, Invoice } from '@solvimon/solvimon-types';
import { computed, nextTick, ref } from 'vue';
import { useTopUpInvoicePreview } from './useTopUpInvoicePreview';

const { mockPreview } = vi.hoisted(() => ({ mockPreview: vi.fn() }));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ previewChargeOnDemandPricingItems: mockPreview }),
}));

const invoice = { id: 'inv_1' } as Invoice;
const amountOf = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

const setup = ({
    scheduleId = 'ppsc_1',
    itemId = 'prii_1',
}: { scheduleId?: string; itemId?: string } = {}) => {
    const amount = ref<Amount>();

    // What the form builds from the entered amount: nothing to charge until one is entered.
    const pricingItems = computed(() =>
        amount.value ? [{ pricing_item_id: itemId, flexible_amount: amount.value }] : undefined,
    );

    return {
        amount,
        ...useTopUpInvoicePreview({
            pricingPlanScheduleId: ref(scheduleId),
            pricingItems,
        }),
    };
};

describe('useTopUpInvoicePreview', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockPreview.mockReset();
        mockPreview.mockResolvedValue(invoice);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('previews the entered amount for the flexible pricing item', async () => {
        const { amount, invoicePreview } = setup();

        amount.value = amountOf('25');
        await vi.runAllTimersAsync();

        expect(mockPreview).toHaveBeenCalledWith({
            pricingPlanScheduleId: 'ppsc_1',
            pricingItems: [{ pricing_item_id: 'prii_1', flexible_amount: amountOf('25') }],
        });
        expect(invoicePreview.value).toEqual(invoice);
    });

    it('waits for typing to settle before requesting a preview', async () => {
        const { amount } = setup();

        amount.value = amountOf('1');
        await nextTick();
        amount.value = amountOf('12');
        await nextTick();
        amount.value = amountOf('125');

        expect(mockPreview).not.toHaveBeenCalled();

        await vi.runAllTimersAsync();

        expect(mockPreview).toHaveBeenCalledTimes(1);
        expect(mockPreview).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingItems: [{ pricing_item_id: 'prii_1', flexible_amount: amountOf('125') }],
            }),
        );
    });

    it('clears the preview when the amount is cleared', async () => {
        const { amount, invoicePreview } = setup();

        amount.value = amountOf('25');
        await vi.runAllTimersAsync();
        expect(invoicePreview.value).toEqual(invoice);

        amount.value = undefined;
        await vi.runAllTimersAsync();

        expect(invoicePreview.value).toBeUndefined();
        expect(mockPreview).toHaveBeenCalledTimes(1);
    });

    it('does not request a preview without a schedule to charge on', async () => {
        const { amount } = setup({ scheduleId: '' });

        amount.value = amountOf('25');
        await vi.runAllTimersAsync();

        expect(mockPreview).not.toHaveBeenCalled();
    });

    it('keeps the newest preview when an earlier request resolves later', async () => {
        const { amount, invoicePreview, loadPreview } = setup();
        const stale = { id: 'inv_stale' } as Invoice;
        const latest = { id: 'inv_latest' } as Invoice;

        let resolveStale: (value: Invoice) => void = () => {};
        mockPreview.mockImplementationOnce(
            () =>
                new Promise<Invoice>((resolve) => {
                    resolveStale = resolve;
                }),
        );
        mockPreview.mockResolvedValueOnce(latest);

        amount.value = amountOf('25');
        const stalePromise = loadPreview();
        amount.value = amountOf('50');
        await loadPreview();

        resolveStale(stale);
        await stalePromise;

        expect(invoicePreview.value).toEqual(latest);
    });

    it('clears the preview and keeps the modal usable when the request fails', async () => {
        const { amount, invoicePreview, isPreviewPending } = setup();

        mockPreview.mockRejectedValueOnce(new Error('nope'));

        amount.value = amountOf('25');
        await vi.runAllTimersAsync();

        expect(invoicePreview.value).toBeUndefined();
        expect(isPreviewPending.value).toBe(false);
    });
});
