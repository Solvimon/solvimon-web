import type { Invoice } from '@solvimon/solvimon-types';
import { useSubscriptionPlanChangePreview } from './useSubscriptionPlanChangePreview';

const { mockGetChangePlanInvoicePreview, mockLoggerError } = vi.hoisted(() => ({
    mockGetChangePlanInvoicePreview: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getChangePlanInvoicePreview: mockGetChangePlanInvoicePreview }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

const invoice = { id: 'invo_pro' } as unknown as Invoice;

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

describe('useSubscriptionPlanChangePreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetChangePlanInvoicePreview.mockResolvedValue(invoice);
    });

    it('previews the move of the subscription to the plan picked', async () => {
        const { load, invoice: previewed } = useSubscriptionPlanChangePreview();

        await load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });

        expect(mockGetChangePlanInvoicePreview).toHaveBeenCalledWith({
            id: 'ppsu_1',
            pricingPlanId: 'ppla_pro',
        });
        expect(previewed.value).toEqual(invoice);
    });

    it('is pending until the preview comes back', async () => {
        const response = deferred<Invoice>();
        mockGetChangePlanInvoicePreview.mockReturnValue(response.promise);
        const { load, isPending } = useSubscriptionPlanChangePreview();

        const loading = load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });

        expect(isPending.value).toBe(true);
        response.resolve(invoice);
        await loading;
        expect(isPending.value).toBe(false);
    });

    it('does not show the price of the plan picked before while the next one loads', async () => {
        const { load, invoice: previewed } = useSubscriptionPlanChangePreview();
        await load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });

        mockGetChangePlanInvoicePreview.mockReturnValue(new Promise(() => {}));
        void load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_scale' });

        expect(previewed.value).toBeUndefined();
    });

    it('keeps the preview of the plan picked last when an earlier one answers after it', async () => {
        const slow = deferred<Invoice>();
        const scaleInvoice = { id: 'invo_scale' } as unknown as Invoice;
        mockGetChangePlanInvoicePreview
            .mockReturnValueOnce(slow.promise)
            .mockResolvedValueOnce(scaleInvoice);
        const { load, invoice: previewed } = useSubscriptionPlanChangePreview();

        const first = load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });
        await load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_scale' });
        slow.resolve(invoice);
        await first;

        expect(previewed.value).toEqual(scaleInvoice);
    });

    it('reports a failed preview and logs it as a plan change', async () => {
        const failure = new Error('preview failed');
        mockGetChangePlanInvoicePreview.mockRejectedValue(failure);
        const { load, invoice: previewed, error } = useSubscriptionPlanChangePreview();

        await load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });

        expect(error.value).toBe(failure);
        expect(previewed.value).toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            'INVOICE_PREVIEW_FAILED',
            'Failed to load the invoice preview',
            { preview: 'PLAN_CHANGE' },
            failure,
        );
    });

    it('drops the preview, and the answer to a request still out, once reset', async () => {
        const slow = deferred<Invoice>();
        mockGetChangePlanInvoicePreview.mockReturnValue(slow.promise);
        const { load, reset, invoice: previewed, isPending } = useSubscriptionPlanChangePreview();

        const loading = load({ subscriptionId: 'ppsu_1', pricingPlanId: 'ppla_pro' });
        reset();
        slow.resolve(invoice);
        await loading;

        expect(previewed.value).toBeUndefined();
        expect(isPending.value).toBe(false);
    });
});
