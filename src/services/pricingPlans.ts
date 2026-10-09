import type { PricingPlan } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export interface GetPricingPlanPayload {
    pricingPlanId: PricingPlan['id'];
}

export function createPricingPlansService() {
    const request = createRequestService();
    const config = useConfig();

    /**
     * GET /v1/portal/pricing-plans/{id}
     *
     * A single plan, for naming the options a subscription can move to within its group.
     */
    function getPricingPlan({ pricingPlanId }: GetPricingPlanPayload): Promise<PricingPlan> {
        return request<PricingPlan>({
            url: `${config.apiUrls.config}/portal/pricing-plans/${pricingPlanId}`,
        });
    }

    return { getPricingPlan };
}
