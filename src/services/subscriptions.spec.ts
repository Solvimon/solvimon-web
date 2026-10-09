import type { PricingPlanSchedule } from '@solvimon/solvimon-types';
import { createSubscriptionsService } from './subscriptions';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const schedule = { id: 'ppsc_new' } as PricingPlanSchedule;

describe('subscriptions service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRequest.mockResolvedValue(schedule);
    });

    describe('changeSubscriptionPlan', () => {
        it('posts the target plan to the change-plan action of the subscription', async () => {
            const { changeSubscriptionPlan } = createSubscriptionsService();
            await changeSubscriptionPlan({ id: 'ppsu_1', pricingPlanId: 'ppla_pro' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1/change-plan',
                data: { pricing_plan_id: 'ppla_pro' },
                options: { method: 'POST' },
            });
        });

        it('leaves the timing to the group by sending no start date', async () => {
            const { changeSubscriptionPlan } = createSubscriptionsService();
            await changeSubscriptionPlan({ id: 'ppsu_1', pricingPlanId: 'ppla_pro' });

            // The API rejects a start date outright for NEXT_BILLING_PERIOD transitions.
            expect(mockRequest.mock.calls[0][0].data).not.toHaveProperty('start_at');
        });

        it('sends a billing period only when the customer moves to another one', async () => {
            const { changeSubscriptionPlan } = createSubscriptionsService();
            await changeSubscriptionPlan({
                id: 'ppsu_1',
                pricingPlanId: 'ppla_pro',
                billingPeriod: { type: 'YEAR', value: 1 },
            });

            expect(mockRequest.mock.calls[0][0].data).toEqual({
                pricing_plan_id: 'ppla_pro',
                billing_period: { type: 'YEAR', value: 1 },
            });
        });
    });

    describe('getSubscriptionPricingPlanGroup', () => {
        it('asks the subscription for the group holding its plan', async () => {
            const { getSubscriptionPricingPlanGroup } = createSubscriptionsService();
            await getSubscriptionPricingPlanGroup({ id: 'ppsu_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-subscriptions/ppsu_1/pricing-plan-group',
                query: { expand: ['ALL'] },
                // A plan in no group answers 404, which is the common case rather than a failure.
                options: { expectedStatusCodes: [404] },
            });
        });

        // Without them the screen would fetch every member plan by id just to label its option.
        it('asks for the member plans to come expanded', async () => {
            const { getSubscriptionPricingPlanGroup } = createSubscriptionsService();
            await getSubscriptionPricingPlanGroup({ id: 'ppsu_1' });

            expect(mockRequest.mock.calls[0][0].query).toMatchObject({ expand: ['ALL'] });
        });
    });
});
