import type { PricingExtended, PricingPlanVersionExtended } from '@solvimon/solvimon-types';

export function getAllPricingsFromPricingPlanVersion(
    pricingPlanVersion: PricingPlanVersionExtended,
): PricingExtended[] {
    const pricings =
        pricingPlanVersion.pricing_categories?.flatMap((category) => category.pricings ?? []) ?? [];
    return pricings.filter((pricing) => pricing !== null);
}
