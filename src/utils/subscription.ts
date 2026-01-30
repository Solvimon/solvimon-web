import type {
    PricingExtended,
    PricingGroupExtended,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';

/**
 * Recursively searches for PRICING objects with matching IDs.
 */
export function findPricingsByIds(
    data: PricingPlanSubscriptionExpanded,
    ids: PricingExtended['id'][],
): PricingExtended[] {
    const results: PricingExtended[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function recurse(obj: any) {
        if (Array.isArray(obj)) {
            obj.forEach(recurse);
        } else if (obj && typeof obj === 'object') {
            if (obj.object_type === 'PRICING' && ids.includes(obj.id)) {
                results.push(obj);
            }
            Object.values(obj).forEach(recurse);
        }
    }

    recurse(data);

    return results;
}

export function getPricingGroupsFromExtendedPricingPlanSubscription(
    subscription: PricingPlanSubscriptionExpanded,
): PricingGroupExtended[] {
    return subscription.pricing_plan_schedule_infos.flatMap(
        (info) =>
            info.pricing_plan_version.pricing_categories?.flatMap(
                (category) => category.pricing_groups ?? [],
            ) ?? [],
    );
}
