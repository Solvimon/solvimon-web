import { useHasShippedSubscription } from './useHasShippedSubscription';

const { mockGetPage, mockLoggerError } = vi.hoisted(() => ({
    mockGetPage: vi.fn(),
    mockLoggerError: vi.fn(),
}));

vi.mock('@/services/subscriptions', () => ({
    createSubscriptionsService: () => ({ getSubscriptionsOfEveryStatus: mockGetPage }),
}));

vi.mock('@/components/providers', () => ({
    useLogger: () => ({ error: mockLoggerError }),
}));

const subscriptions = (count: number, shippedAt?: number) =>
    Array.from({ length: count }, (_, index) => ({
        id: `ppsu_${index}`,
        status: 'ENDED',
        default_shipping_address_id: index === shippedAt ? 'shad_1' : null,
    }));

/** A page of the collection response, with a link to the next one when there is more. */
const page = (data: unknown[], hasNext = false) => ({
    data,
    links: { current: 'current', ...(hasNext && { next: 'next' }) },
});

describe('useHasShippedSubscription', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('finds a subscription that ships, whatever its status', async () => {
        mockGetPage.mockResolvedValue(page(subscriptions(3, 1)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasShippedSubscription.value).toBe(true);
        expect(mockGetPage).toHaveBeenCalledWith({ customerId: 'cust_1', page: 1, pageSize: 50 });
    });

    it('answers no when none of the subscriptions ships', async () => {
        mockGetPage.mockResolvedValue(page(subscriptions(3)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasShippedSubscription.value).toBe(false);
        expect(mockGetPage).toHaveBeenCalledTimes(1);
    });

    it('reads on to the next page until it finds one', async () => {
        mockGetPage
            .mockResolvedValueOnce(page(subscriptions(50), true))
            .mockResolvedValueOnce(page(subscriptions(2, 0)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasShippedSubscription.value).toBe(true);
        expect(mockGetPage).toHaveBeenLastCalledWith({
            customerId: 'cust_1',
            page: 2,
            pageSize: 50,
        });
    });

    it('stops at the first subscription that ships', async () => {
        mockGetPage.mockResolvedValueOnce(page(subscriptions(50, 7), true));
        const { check } = useHasShippedSubscription({ customerId: 'cust_1' });

        await check();

        expect(mockGetPage).toHaveBeenCalledTimes(1);
    });

    it('answers no and logs it when the subscriptions cannot be loaded, without failing', async () => {
        const failure = new Error('down');
        mockGetPage.mockRejectedValue(failure);
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await expect(check()).resolves.toBeUndefined();

        expect(hasShippedSubscription.value).toBe(false);
        expect(mockLoggerError).toHaveBeenCalledWith(
            'SHIPPED_SUBSCRIPTIONS_LOAD_FAILED',
            'Failed to find out whether the customer has shipped subscriptions',
            {},
            failure,
        );
    });

    it('asks nothing without a customer', async () => {
        const { check } = useHasShippedSubscription({ customerId: undefined });

        await check();

        expect(mockGetPage).not.toHaveBeenCalled();
    });

    it('stops when there is no next page, even if the page is not full', async () => {
        mockGetPage.mockResolvedValueOnce(page(subscriptions(25)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(mockGetPage).toHaveBeenCalledTimes(1);
        expect(hasShippedSubscription.value).toBe(false);
    });

    it('reads on while there is a next page, even if the page is not full', async () => {
        mockGetPage
            .mockResolvedValueOnce(page(subscriptions(25), true))
            .mockResolvedValueOnce(page(subscriptions(1, 0)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check();

        expect(hasShippedSubscription.value).toBe(true);
    });

    it('settles it from the subscriptions already loaded, without asking', async () => {
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check(subscriptions(2, 1) as never);

        expect(hasShippedSubscription.value).toBe(true);
        expect(mockGetPage).not.toHaveBeenCalled();
    });

    it('reads the rest when none of the loaded subscriptions ships', async () => {
        mockGetPage.mockResolvedValue(page(subscriptions(3, 2)));
        const { hasShippedSubscription, check } = useHasShippedSubscription({
            customerId: 'cust_1',
        });

        await check(subscriptions(2) as never);

        expect(mockGetPage).toHaveBeenCalled();
        expect(hasShippedSubscription.value).toBe(true);
    });
});
