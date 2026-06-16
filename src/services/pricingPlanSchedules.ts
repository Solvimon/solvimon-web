import type { Invoice } from '@solvimon/solvimon-types';
import { createRequestService } from './requests';
import { useConfig } from '@/components/providers/ConfigProvider/composables/useConfig';
import type { OnDemandPricingItemsResponse } from '@/components/subscriptions/UpgradeSubscription/UpgradeSubscription.types';

export interface ChargeOnDemandPricingItemsPayload {
    scheduleId: string;
    pricingPlanVersionId?: string;
    pricingItemIds: string[];
    /** ISO timestamp — optional, defaults to now on the BE. */
    startAt?: string;
    finalizeImmediately?: boolean;
    /**
     * Saved payment method id (pmet_xxx). When provided the invoice is created
     * AND paid in a single call, so the caller can show a success state directly.
     * Omit for new payment methods — the caller should redirect to invoice-pay instead.
     */
    paymentMethodId?: string;
}

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

    /**
     * POST /v1/portal/pricing-plan-schedules/{id}/charge-on-demand-pricing-items
     *
     * Creates (and optionally finalises) an invoice for the selected on-demand
     * pricing items. Returns the generated invoice.
     */
    function chargeOnDemandPricingItems({
        scheduleId,
        pricingPlanVersionId,
        pricingItemIds,
        startAt,
        finalizeImmediately = true,
        paymentMethodId,
    }: ChargeOnDemandPricingItemsPayload): Promise<Invoice> {
        return request<Invoice>({
            url: `${config.apiUrls.config}/portal/pricing-plan-schedules/${scheduleId}/charge-on-demand-pricing-items`,
            options: { method: 'POST' },
            data: {
                ...(pricingPlanVersionId ? { pricing_plan_version_id: pricingPlanVersionId } : {}),
                pricing_item_ids: pricingItemIds,
                ...(startAt ? { start_at: startAt } : {}),
                finalize_immediately: finalizeImmediately,
                ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
            },
        });
    }

    return {
        chargeOnDemandPricingItems,
        getOnDemandPricingItems,
    };
}
