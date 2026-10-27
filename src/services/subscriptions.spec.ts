import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import { createSubscriptionsService } from './subscriptions';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const subscription = { id: 'ppsu_1' } as PricingPlanSubscription;

describe('subscriptions service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue(subscription);
    });

    describe('getSubscription', () => {
        it('reads the subscription by id without expanding it by default', async () => {
            const { getSubscription } = createSubscriptionsService();
            const response = await getSubscription({ id: 'ppsu_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1',
                query: {},
            });
            expect(response).toBe(subscription);
        });

        it('expands everything when asked for the expanded subscription', async () => {
            const { getSubscription } = createSubscriptionsService();
            await getSubscription({ id: 'ppsu_1', expanded: true });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1',
                query: { expand: ['ALL'] },
            });
        });
    });

    describe('getSubscriptionsOfEveryStatus', () => {
        it('asks for a page of the customer subscriptions, whatever their status or type', async () => {
            const { getSubscriptionsOfEveryStatus } = createSubscriptionsService();
            await getSubscriptionsOfEveryStatus({ customerId: 'cust_1', page: 2, pageSize: 50 });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions',
                query: { customer_id: 'cust_1', page: '2', limit: 50 },
                isCollection: true,
            });
        });
    });

    describe('getActiveSubscriptions', () => {
        it('asks for the active billing subscriptions of the customer, expanded, from the first page', async () => {
            const collection = { data: [subscription], links: { current: 'current' } };
            mockRequest.mockResolvedValue(collection);

            const { getActiveSubscriptions } = createSubscriptionsService();
            const response = await getActiveSubscriptions({ customerId: 'cust_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions',
                query: {
                    customer_id: 'cust_1',
                    statuses: ['ACTIVE'],
                    type: 'BILLING',
                    expand: ['ALL'],
                    page: '1',
                },
                isCollection: true,
            });
            expect(response).toBe(collection);
        });

        it('sends the page, page size and ordering it is given', async () => {
            const { getActiveSubscriptions } = createSubscriptionsService();
            await getActiveSubscriptions({
                customerId: 'cust_1',
                pagination: {
                    page: 3,
                    pageSize: 10,
                    orderBy: 'created_at',
                    orderDirection: 'desc',
                },
            });

            expect(mockRequest.mock.calls[0][0].query).toEqual({
                customer_id: 'cust_1',
                statuses: ['ACTIVE'],
                type: 'BILLING',
                expand: ['ALL'],
                page: '3',
                limit: 10,
                order_by: 'created_at',
                order_direction: 'desc',
            });
        });
    });

    describe('setSubscriptionCancellation', () => {
        it('cancels at the end of the billing period', async () => {
            const { setSubscriptionCancellation } = createSubscriptionsService();
            const response = await setSubscriptionCancellation({ id: 'ppsu_1', variant: 'CANCEL' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1/cancel',
                data: { type: 'NEXT_BILLING_PERIOD' },
                options: { method: 'POST' },
            });
            expect(response).toBe(subscription);
        });

        it('undoes a pending cancellation through the same action when renewing', async () => {
            const { setSubscriptionCancellation } = createSubscriptionsService();
            await setSubscriptionCancellation({ id: 'ppsu_1', variant: 'RENEW' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1/cancel',
                data: { type: 'UNDO' },
                options: { method: 'POST' },
            });
        });
    });
});
