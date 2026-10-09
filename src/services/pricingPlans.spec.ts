import { createPricingPlansService } from './pricingPlans';
import type { PricingPlan } from '@solvimon/solvimon-types';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('./requests', () => ({
    createRequestService: () => mockRequest,
}));

vi.mock('@/components/providers/ConfigProvider/composables/useConfig', () => ({
    useConfig: () => ({ apiUrls: { config: 'https://api.test' } }),
}));

const plan = { id: 'ppla_1', name: 'Pro' } as PricingPlan;

describe('pricingPlans service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('asks for the plan by its id', async () => {
        mockRequest.mockResolvedValue(plan);

        const { getPricingPlan } = createPricingPlansService();
        await getPricingPlan({ pricingPlanId: 'ppla_1' });

        expect(mockRequest).toHaveBeenCalledWith({
            url: 'https://api.test/portal/pricing-plans/ppla_1',
        });
    });
});
