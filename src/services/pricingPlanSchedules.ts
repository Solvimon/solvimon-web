import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { OnDemandPricingItemsResponse } from '@/components/subscriptions/UpgradeSubscription/UpgradeSubscription.types';

export interface GetOnDemandPricingItemsPayload {
    scheduleId: string;
}

export function createPricingPlanSchedulesService() {
    const request = createRequestService();
    const config = useConfig();

    /**
     * GET /v1/portal/pricing-plan-schedules/{id}/on-demand-pricing-items
     *
     * Returns on-demand add-ons available for the pricing plan schedule.
     */
    function getOnDemandPricingItems({
        scheduleId,
    }: GetOnDemandPricingItemsPayload): Promise<OnDemandPricingItemsResponse> {
        return request<OnDemandPricingItemsResponse>({
            url: `${config.apiUrls.config}/portal/pricing-plan-schedules/${scheduleId}/on-demand-pricing-items`,
        });
    }

    return {
        getOnDemandPricingItems,
    };
}
