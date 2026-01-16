import type { PricingExtended, PricingPlanScheduleInfoExpanded } from '@solvimon/types';

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
