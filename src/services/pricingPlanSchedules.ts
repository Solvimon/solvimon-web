import type {
    EnabledPricing,
    OnDemandPricingItemsResponse,
    PricingPlanSchedule,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';

export interface GetOnDemandPricingItemsPayload {
    scheduleId: string;
}

export interface CreatePricingPlanSchedulePayload {
    pricingPlanSubscriptionId: PricingPlanSubscription['id'];
    /** The pricings the schedule should run with — the full set, not just the ones that changed. */
    enabledPricings: EnabledPricing[];
}

export function createPricingPlanSchedulesService() {
    const request = createRequestService();
    const config = useConfig();

    /**
     * GET /v1/portal/pricing-plan-schedules/{id}/on-demand-pricing-items
     *
     * Returns the schedule's One Off items with an on-demand config, as pricing categories.
     */
    function getOnDemandPricingItems({
        scheduleId,
    }: GetOnDemandPricingItemsPayload): Promise<OnDemandPricingItemsResponse> {
        return request<OnDemandPricingItemsResponse>({
            url: `${config.apiUrls.config}/portal/pricing-plan-schedules/${scheduleId}/on-demand-pricing-items`,
        });
    }

    /**
     * POST /v1/portal/pricing-plan-schedules
     *
     * Starts a new schedule on the subscription with the given pricings enabled — how a plan change
     * is committed. The pricings not being changed have to be sent along too, since the new schedule
     * replaces the old one rather than being merged into it.
     */
    function createPricingPlanSchedule({
        pricingPlanSubscriptionId,
        enabledPricings,
    }: CreatePricingPlanSchedulePayload): Promise<PricingPlanSchedule> {
        return request<PricingPlanSchedule>({
            url: `${config.apiUrls.config}/portal/pricing-plan-schedules`,
            options: { method: 'POST' },
            data: {
                pricing_plan_subscription_id: pricingPlanSubscriptionId,
                enabled_pricings: enabledPricings,
                start_at: new Date().toJSON(),
            },
        });
    }

    return {
        getOnDemandPricingItems,
        createPricingPlanSchedule,
    };
}
