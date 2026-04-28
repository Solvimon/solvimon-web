import type {
    BillingPeriod,
    ConfiguredMeterValue,
    EnabledPricing,
    PricingExtended,
    PricingPlanScheduleCustomization,
    PricingPlanScheduleInfo,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';

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

export type PricingItemConfigMeta = {
    currency: string;
    billingPeriod?: BillingPeriod;
};

export function getPricingItemConfigMetaById({
    pricingPlanScheduleInfo,
}: {
    pricingPlanScheduleInfo: PricingPlanScheduleInfoExpanded;
}): Map<string, PricingItemConfigMeta> {
    const metaById = new Map<string, PricingItemConfigMeta>();
    const categories = pricingPlanScheduleInfo.pricing_plan_version.pricing_categories ?? [];

    categories.forEach((category) => {
        category.pricings?.forEach((pricing) => {
            pricing.items?.forEach((item) => {
                item.pricing_currency_configs?.forEach((currencyConfig) => {
                    const currency = currencyConfig.currency;

                    currencyConfig.billing_period_configs?.forEach((billingConfig) => {
                        billingConfig.configs?.forEach((config) => {
                            if (config.id) {
                                metaById.set(config.id, {
                                    currency,
                                    billingPeriod: billingConfig.billing_period,
                                });
                            }
                        });
                    });

                    currencyConfig.configs?.forEach((config) => {
                        if (config.id) {
                            metaById.set(config.id, { currency });
                        }
                    });
                });
            });
        });
    });

    return metaById;
}

/**
 * Get the schedule customizations for a given pricing plan schedule.
 */
export function getScheduleCustomizations({
    enabledPricings,
    seatsValues,
    pricingPlanScheduleInfos,
    pricingCurrency,
    billingPeriod,
}: {
    enabledPricings?: EnabledPricing[];
    seatsValues?: ConfiguredMeterValue[];
    pricingPlanScheduleInfos: PricingPlanScheduleInfoExpanded[];
    pricingCurrency?: string;
    billingPeriod?: BillingPeriod;
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
            ...(pricingCurrency && { pricing_currency: pricingCurrency }),
            ...(billingPeriod && { billing_period: billingPeriod }),
        },
    ];
}
