import type { PricingExtended, PricingPlanScheduleInfoExpanded } from '@solvimon/types';
import { isEmpty } from 'lodash-es';

export function getAllPricingsFromScheduleInfos(
    scheduleInfos: PricingPlanScheduleInfoExpanded[],
): PricingExtended[] {
    return scheduleInfos.flatMap(
        (scheduleInfo) =>
            scheduleInfo.pricing_plan_version.pricing_categories?.flatMap(
                (category) => category.pricings ?? [],
            ) ?? [],
    );
}

export function getNameFromPricing(pricing: PricingExtended): string | undefined {
    return !isEmpty(pricing.name) ? pricing.name : pricing.products?.[0]?.name;
}
