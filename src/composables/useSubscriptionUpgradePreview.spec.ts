import type { Invoice } from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { useSubscriptionUpgradePreview } from './useSubscriptionUpgradePreview';

const { mockGetInvoicePreview, mockLoggerError } = vi.hoisted(() => ({
    mockGetInvoicePreview: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/invoices', () => ({
    createInvoicesService: () => ({ getInvoicePreview: mockGetInvoicePreview }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

const invoice = { id: 'invo_1' } as unknown as Invoice;

const createSubscription = (scheduleType = 'DEFAULT') =>
    ({
        id: 'ppsu_1',
        pricing_plan_schedule_infos: [
            {
                id: 'ppsc_1',
                pricing_plan_schedule: { id: 'ppsc_1', type: scheduleType },
            },
        ],
    }) as unknown as PricingPlanSubscriptionExpanded;

describe('useSubscriptionUpgradePreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetInvoicePreview.mockResolvedValue({ invoice });
    });

    it('previews the change on the default schedule', async () => {
        const { load, invoice: previewed } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith(
            expect.objectContaining({
                pricingPlanSubscriptionId: 'ppsu_1',
                customizations: [
                    expect.objectContaining({
                        pricing_plan_schedule_id: 'ppsc_1',
                        enabled_pricings: [{ pricing_id: 'pric_premium' }],
                    }),
                ],
            }),
        );
        expect(previewed.value).toEqual(invoice);
    });

    it('prices the subscription as it stands rather than as a template for a new one', async () => {
        const { load } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith(
            expect.objectContaining({ forExistingSubscription: true }),
        );
    });

    it('leaves the customer out, since the subscription already belongs to one', async () => {
        const { load } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview.mock.calls[0][0]).not.toHaveProperty('customer');
    });

    it('does not request a preview without a default schedule to bill it on', async () => {
        const { load, invoice: previewed } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription('TRIAL'),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview).not.toHaveBeenCalled();
        expect(previewed.value).toBeUndefined();
    });

    it('reports failures and keeps no stale invoice', async () => {
        mockGetInvoicePreview.mockRejectedValue(new Error('nope'));
        const { load, invoice: previewed, error } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(error.value).toBeInstanceOf(Error);
        expect(previewed.value).toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            'INVOICE_PREVIEW_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });

    it('clears the pending flag once the request settles', async () => {
        const { load, isPending } = useSubscriptionUpgradePreview();

        const pending = load({
            subscription: createSubscription(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(isPending.value).toBe(true);

        await pending;

        expect(isPending.value).toBe(false);
    });

    it('ignores a slow response once a later choice has been previewed', async () => {
        const slowInvoice = { id: 'invo_slow' } as unknown as Invoice;
        const fastInvoice = { id: 'invo_fast' } as unknown as Invoice;
        let resolveSlow: (value: unknown) => void = () => {};

        mockGetInvoicePreview
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveSlow = resolve;
                    }),
            )
            .mockResolvedValueOnce({ invoice: fastInvoice });

        const { load, invoice: previewed } = useSubscriptionUpgradePreview();
        const subscription = createSubscription();

        const slow = load({ subscription, enabledPricingIds: ['pric_basic'] });
        await load({ subscription, enabledPricingIds: ['pric_premium'] });

        resolveSlow({ invoice: slowInvoice });
        await slow;

        expect(previewed.value).toEqual(fastInvoice);
    });
});
