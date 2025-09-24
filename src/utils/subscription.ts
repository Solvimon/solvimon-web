import type { Pricing, PricingPlanSubscriptionExpanded } from '@solvimon/types';

export function findSubscriptionPricingsByIds(
    data: PricingPlanSubscriptionExpanded,
    pricingIds: Pricing['id'][]
) {
    const idSet = new Set(Array.isArray(pricingIds) ? pricingIds : [pricingIds]);

    return data.pricing_plan_schedule_infos?.flatMap((schedule) =>
        schedule.pricing_plan_version.pricing_categories?.flatMap((category) =>
            category.pricings
                ?.filter((pricing) => idSet.has(pricing.id))
                .map((pricing) => ({ pricing }))
        )
    );
}
