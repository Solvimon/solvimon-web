import type {
    BillingPeriod,
    ConfiguredMeterValue,
    EnabledPricing,
    Pricing,
    PricingExtended,
    PricingGroupExtended,
    PricingPlanScheduleCustomization,
    PricingPlanScheduleInfo,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

/**
 * Get the first pricing plan schedule of a given type.
 *
 * The type is read off the nested schedule where the response carries one and off the info itself
 * otherwise, since which of the two is filled in depends on what the request expanded. Neither is
 * reached into blindly: this runs before a screen has anything to show, so throwing here takes the
 * whole screen down rather than one part of it.
 */
export function getFirstPricingPlanScheduleOfType({
    pricingPlanScheduleInfos,
    type,
}: {
    pricingPlanScheduleInfos: PricingPlanScheduleInfoExpanded[] | undefined;
    type: PricingPlanScheduleInfo['type'];
}): PricingPlanScheduleInfoExpanded | undefined {
    return (pricingPlanScheduleInfos ?? []).find(
        (scheduleInfo) => (scheduleInfo.pricing_plan_schedule?.type ?? scheduleInfo.type) === type,
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
    return getActiveDefaultScheduleInfo(
        subscriptions.flatMap(
            ({ pricing_plan_schedule_infos }) => pricing_plan_schedule_infos ?? [],
        ),
    )?.id;
}

/** The dates live on the schedule itself; the info only repeats them for some responses. */
const getStartAt = (scheduleInfo: PricingPlanScheduleInfoExpanded): number =>
    Date.parse(scheduleInfo.start_at ?? scheduleInfo.pricing_plan_schedule?.start_at);

/**
 * The schedule being billed right now out of the ones given: the most recently started DEFAULT
 * schedule that has begun and has not ended. Returns undefined when none of them is running.
 */
export function getActiveDefaultScheduleInfo(
    scheduleInfos: PricingPlanScheduleInfoExpanded[],
): PricingPlanScheduleInfoExpanded | undefined {
    const now = Date.now();

    return scheduleInfos
        .filter((scheduleInfo) => {
            const schedule = scheduleInfo.pricing_plan_schedule;
            const type = schedule?.type ?? scheduleInfo.type;
            const startAt = getStartAt(scheduleInfo);
            const endAtValue = scheduleInfo.end_at ?? schedule?.end_at;
            const endAt = endAtValue ? Date.parse(endAtValue) : undefined;
            const hasStarted = Number.isFinite(startAt) && startAt <= now;
            const hasNotEnded = endAt === undefined || !Number.isFinite(endAt) || endAt > now;

            return type === 'DEFAULT' && hasStarted && hasNotEnded;
        })
        .sort((a, b) => getStartAt(b) - getStartAt(a))
        .at(0);
}

/**
 * The group a pricing was chosen from, which is what names the choice the customer made
 * ("Credit packs") rather than the option they took ("1.000 credits"). Pricings that sit directly
 * on a category belong to no group and come back undefined.
 */
export function getPricingGroupByPricingId({
    pricingPlanScheduleInfo,
    pricingId,
}: {
    pricingPlanScheduleInfo: PricingPlanScheduleInfoExpanded;
    pricingId: Pricing['id'];
}): PricingGroupExtended | undefined {
    return (pricingPlanScheduleInfo.pricing_plan_version?.pricing_categories ?? [])
        .flatMap((category) => category.pricing_groups ?? [])
        .find((group) => (group.pricings ?? []).some((pricing) => pricing.id === pricingId));
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
