import type { EnabledPricing, PricingPlanSchedule } from '@solvimon/solvimon-types';
import { createPricingPlanSchedulesService } from './pricingPlanSchedules';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

describe('pricingPlanSchedules service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getOnDemandPricingItems', () => {
        it('asks for the on-demand items of the given schedule', async () => {
            const items = { data: [] };
            mockRequest.mockResolvedValue(items);

            const { getOnDemandPricingItems } = createPricingPlanSchedulesService();
            const response = await getOnDemandPricingItems({ scheduleId: 'pps_1' });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-schedules/pps_1/on-demand-pricing-items',
            });
            expect(response).toBe(items);
        });
    });

    describe('createPricingPlanSchedule', () => {
        it('posts a schedule starting now with the full set of pricings', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
            const schedule = { id: 'pps_2' } as PricingPlanSchedule;
            mockRequest.mockResolvedValue(schedule);
            const enabledPricings = [
                { pricing_id: 'pric_1' },
                { pricing_id: 'pric_2' },
            ] as unknown as EnabledPricing[];

            const { createPricingPlanSchedule } = createPricingPlanSchedulesService();
            const response = await createPricingPlanSchedule({
                pricingPlanSubscriptionId: 'ppsu_1',
                enabledPricings,
            });

            expect(mockRequest).toHaveBeenCalledWith({
                url: 'https://api.test/portal/pricing-plan-schedules',
                options: { method: 'POST' },
                data: {
                    pricing_plan_subscription_id: 'ppsu_1',
                    enabled_pricings: enabledPricings,
                    start_at: '2026-03-01T12:00:00.000Z',
                },
            });
            expect(response).toBe(schedule);
        });
    });
});
