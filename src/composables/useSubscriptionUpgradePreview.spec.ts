import type {
    Invoice,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
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

const createScheduleInfo = (id = 'ppsc_1', scheduleType = 'DEFAULT') =>
    ({
        id,
        pricing_plan_schedule: { id, type: scheduleType },
    }) as unknown as PricingPlanScheduleInfoExpanded;

const createSubscription = (scheduleType = 'DEFAULT') =>
    ({
        id: 'ppsu_1',
        pricing_plan_schedule_infos: [createScheduleInfo('ppsc_1', scheduleType)],
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
            scheduleInfo: createScheduleInfo(),
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

    it('previews on the schedule it is given, not the first one the subscription lists', async () => {
        const { load } = useSubscriptionUpgradePreview();

        await load({
            subscription: {
                id: 'ppsu_1',
                pricing_plan_schedule_infos: [
                    createScheduleInfo('ppsc_ended'),
                    createScheduleInfo('ppsc_active'),
                ],
            } as unknown as PricingPlanSubscriptionExpanded,
            scheduleInfo: createScheduleInfo('ppsc_active'),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview).toHaveBeenCalledWith(
            expect.objectContaining({
                customizations: [
                    expect.objectContaining({ pricing_plan_schedule_id: 'ppsc_active' }),
                ],
            }),
        );
    });

    it('does not request a preview while no schedule is being billed', async () => {
        const { load, invoice: previewed } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            scheduleInfo: undefined,
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview).not.toHaveBeenCalled();
        expect(previewed.value).toBeUndefined();
    });

    it('lets a request still in flight go once there is no schedule to bill on', async () => {
        let resolveSlow: (value: unknown) => void = () => {};
        mockGetInvoicePreview.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveSlow = resolve;
                }),
        );
        const { load, invoice: previewed, isPending } = useSubscriptionUpgradePreview();
        const subscription = createSubscription();

        const slow = load({
            subscription,
            scheduleInfo: createScheduleInfo(),
            enabledPricingIds: ['pric_basic'],
        });
        await load({ subscription, scheduleInfo: undefined, enabledPricingIds: ['pric_basic'] });

        resolveSlow({ invoice });
        await slow;

        expect(previewed.value).toBeUndefined();
        expect(isPending.value).toBe(false);
    });

    it('prices the subscription as it stands rather than as a template for a new one', async () => {
        const { load } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription(),
            scheduleInfo: createScheduleInfo(),
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
            scheduleInfo: createScheduleInfo(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(mockGetInvoicePreview.mock.calls[0][0]).not.toHaveProperty('customer');
    });

    it('does not request a preview without a default schedule to bill it on', async () => {
        const { load, invoice: previewed } = useSubscriptionUpgradePreview();

        await load({
            subscription: createSubscription('TRIAL'),
            scheduleInfo: createScheduleInfo('ppsc_1', 'TRIAL'),
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
            scheduleInfo: createScheduleInfo(),
            enabledPricingIds: ['pric_premium'],
        });

        expect(error.value).toBeInstanceOf(Error);
        expect(previewed.value).toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalledWith(
            'INVOICE_PREVIEW_FAILED',
            expect.any(String),
            { preview: 'SUBSCRIPTION_UPGRADE' },
            expect.any(Error),
        );
    });

    it('clears the pending flag once the request settles', async () => {
        const { load, isPending } = useSubscriptionUpgradePreview();

        const pending = load({
            subscription: createSubscription(),
            scheduleInfo: createScheduleInfo(),
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

        const scheduleInfo = createScheduleInfo();

        const slow = load({ subscription, scheduleInfo, enabledPricingIds: ['pric_basic'] });
        await load({ subscription, scheduleInfo, enabledPricingIds: ['pric_premium'] });

        resolveSlow({ invoice: slowInvoice });
        await slow;

        expect(previewed.value).toEqual(fastInvoice);
    });
});
