import type {
    BillingPeriod,
    ConfiguredMeterValue,
    EnabledPricing,
    PricingExtended,
    PricingPlanScheduleCustomization,
    PricingPlanScheduleInfo,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscriptionExpanded,
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

/**
 * The schedule a customer is billed on right now: the most recently started DEFAULT schedule that
 * has begun and has not ended yet. One-off charges — a wallet top-up for instance — are invoiced
 * on that schedule. Returns undefined when no subscription is currently running.
 */
export function getActiveDefaultScheduleId(
    subscriptions: PricingPlanSubscriptionExpanded[],
): PricingPlanScheduleInfoExpanded['id'] | undefined {
    const now = Date.now();

    return subscriptions
        .flatMap(({ pricing_plan_schedule_infos }) => pricing_plan_schedule_infos ?? [])
        .filter((scheduleInfo) => {
            const type = scheduleInfo.pricing_plan_schedule?.type ?? scheduleInfo.type;
            const startAt = Date.parse(scheduleInfo.start_at);
            const endAt = scheduleInfo.end_at ? Date.parse(scheduleInfo.end_at) : undefined;
            const hasStarted = Number.isFinite(startAt) && startAt <= now;
            const hasNotEnded = endAt === undefined || !Number.isFinite(endAt) || endAt > now;

            return type === 'DEFAULT' && hasStarted && hasNotEnded;
        })
        .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
        .at(0)?.id;
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
    currency?: string;
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
                item.billing_period_configs?.forEach((billingConfig) => {
                    billingConfig.configs?.forEach((config) => {
                        if (config.id) {
                            const currency = config.details?.bands?.find(
                                (band) => band.amount?.currency,
                            )?.amount?.currency;

                            metaById.set(config.id, {
                                ...(currency && { currency }),
                                billingPeriod: billingConfig.billing_period,
                            });
                        }
                    });
                });

                item.configs?.forEach((config) => {
                    if (config.id) {
                        const currency = config.details?.bands?.find(
                            (band) => band.amount?.currency,
                        )?.amount?.currency;

                        metaById.set(config.id, {
                            ...(currency && { currency }),
                        });
                    }
                });

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
