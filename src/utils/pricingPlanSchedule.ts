import type {
    ConfiguredMeterValue,
    EnabledPricing,
    PricingExtended,
    PricingPlanScheduleCustomization,
    PricingPlanScheduleInfo,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/types';

/**
 * Get the first pricing plan schedule of a given type.
 */
export function getFirstPricingPlanScheduleOfType({
    pricingPlanScheduleInfos,
    type,
}: {
    pricingPlanScheduleInfos: PricingPlanScheduleInfoExpanded[];
    type: PricingPlanScheduleInfo['type'];
}): PricingPlanScheduleInfoExpanded | undefined {
    return pricingPlanScheduleInfos.find(
        (scheduleInfo) => scheduleInfo.pricing_plan_schedule.type === type,
    );
}

export function getAllPricingsFromScheduleInfos({
    pricingPlanScheduleInfo,
}: {
    pricingPlanScheduleInfo: PricingPlanScheduleInfoExpanded;
}): PricingExtended[] {
    const categories = pricingPlanScheduleInfo.pricing_plan_version.pricing_categories ?? [];
    return categories.flatMap((category) => category.pricings ?? []);
}

/**
 * Get the schedule customizations for a given pricing plan schedule.
 */
export function getScheduleCustomizations({
    enabledPricings,
    seatsValues,
    pricingPlanScheduleInfos,
}: {
    enabledPricings?: EnabledPricing[];
    seatsValues?: ConfiguredMeterValue[];
    pricingPlanScheduleInfos: PricingPlanScheduleInfoExpanded[];
}): PricingPlanScheduleCustomization[] | undefined {
    const subscriptionSchedule = getFirstPricingPlanScheduleOfType({
        pricingPlanScheduleInfos,
        type: 'DEFAULT',
    });

    if (!subscriptionSchedule || (!enabledPricings && !seatsValues)) {
        return undefined;
    }

    return [
        {
            pricing_plan_schedule_id: subscriptionSchedule.id,
            enabled_pricings: enabledPricings,
            seats_values: seatsValues?.map(({ pricing_item_config_id, number }) => ({
                pricing_item_config_id,
                number,
            })),
        },
    ];
}
