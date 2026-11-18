import { useHasSelfBillingSubscription } from './useHasSelfBillingSubscription';

const { mockService, mockLoggerError } = vi.hoisted(() => ({
    mockService: { getSubscriptionsOfVariant: vi.fn() },
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => mockService,
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

describe('useHasSelfBillingSubscription', () => {
    beforeEach(() => vi.clearAllMocks());

    it('is true when the customer has a self-billing subscription', async () => {
        mockService.getSubscriptionsOfVariant.mockResolvedValue({ data: [{ id: 'ppsu_1' }] });
        const { hasSelfBillingSubscription, check } = useHasSelfBillingSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasSelfBillingSubscription.value).toBe(true);
        expect(mockService.getSubscriptionsOfVariant).toHaveBeenCalledWith({
            customerId: 'cust_1',
            variant: 'SELF_BILLING',
            pageSize: 1,
        });
    });

    it('stays false without one', async () => {
        mockService.getSubscriptionsOfVariant.mockResolvedValue({ data: [] });
        const { hasSelfBillingSubscription, check } = useHasSelfBillingSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasSelfBillingSubscription.value).toBe(false);
    });

    it('stays false and logs when the subscriptions cannot be read', async () => {
        mockService.getSubscriptionsOfVariant.mockRejectedValue(new Error('down'));
        const { hasSelfBillingSubscription, check } = useHasSelfBillingSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasSelfBillingSubscription.value).toBe(false);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SELF_BILLING_SUBSCRIPTIONS_LOAD_FAILED',
            expect.any(String),
            {},
            expect.any(Error),
        );
    });
});
