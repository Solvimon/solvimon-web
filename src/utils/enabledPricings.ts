import type { Pricing, PricingPlanSubscriptionExpanded } from '@solvimon/types';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from './subscription';
import { getAllPricingsFromScheduleInfos } from './pricing';

/**
 * Utility function to preselect enabled pricings based on the subscription.
 */
export function withPreselectedEnabledPricings(
    subscription: PricingPlanSubscriptionExpanded,
    enabledPricingIds: Pricing['id'][] | undefined = undefined,
): Pricing['id'][] {
    const result: Pricing['id'][] = enabledPricingIds ?? [];

    const pricingGroups = getPricingGroupsFromExtendedPricingPlanSubscription(subscription);

    for (const pricingGroup of pricingGroups) {
        // Single select - select first pricing
        if (['EXACTLY_ONE', 'AT_LEAST_ONE'].includes(pricingGroup.selection_constraint)) {
            const groupPricingIds = pricingGroup.pricings.map((pricing) => pricing.id);

            if (enabledPricingIds?.some((id) => groupPricingIds.includes(id))) {
                continue;
            }

            result.push(pricingGroup.pricings[0].id);
        }
    }

    return result;
}

/**
 * Utility function to check if a subscription has enabled pricings.
 */
export function isSubscriptionWithEnabledPricings(
    subscription: PricingPlanSubscriptionExpanded,
): boolean {
    const pricingGroups = getPricingGroupsFromExtendedPricingPlanSubscription(subscription);

    return pricingGroups.some(
        (pricingGroup) =>
            pricingGroup.selection_constraint === 'EXACTLY_ONE' ||
            pricingGroup.selection_constraint === 'AT_LEAST_ONE',
    );
}

export function isSubscriptionWithAddonProducts(subscription: PricingPlanSubscriptionExpanded) {
    const pricings = getAllPricingsFromScheduleInfos(subscription.pricing_plan_schedule_infos);
    const pricingGroups = getPricingGroupsFromExtendedPricingPlanSubscription(subscription);

    return (
        pricings.some((pricing) => pricing.product_type === 'ADDON') ||
        pricingGroups.some((pricingGroup) => pricingGroup.object_type === 'ADDON')
    );
}
