import type {
    BillingPeriod,
    EntitlementExtended,
    Pricing,
    PricingCategoryExtended,
    PricingCurrencyConfig,
    PricingExtended,
    PricingItemConfigBillingPeriodConfig,
    PricingItemConfigExtended,
    PricingItemExtended,
    PricingPlanSchedule,
    PricingPlanScheduleWithPlanData,
    PricingPlanVersionExtended,
} from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

/**
 * Desk reads price customizations off `combined_pricing_plan_version`: a version the API returns
 * with the schedule's `override_pricings` already folded into the plan's own pricings. The portal
 * endpoints do not serve that property, but the expanded subscription carries both halves — the
 * plan version on `pricing_plan_schedule_infos[].pricing_plan_version` and the overrides on
 * `pricing_plan_schedule.override_pricings` — so the same version can be composed here instead.
 *
 * Pricing defined directly on a schedule (`schedule.pricing_categories`) is deliberately left out:
 * the API does not merge it into the combined version either, and desk renders it as a separate
 * block (see DD-3003 / MD-5036).
 */

/**
 * The override side of the merge. Overrides read off the API are saved `Pricing` objects, but the
 * schedule type also admits the unsaved shapes the desk forms hold, which have the same fields with
 * looser optionality. Everything below only reads fields the two shapes share and falls back to the
 * original whenever an id is absent, so the merge is done through the saved (expanded) shape.
 */
type OverridePricing = PricingExtended;
type OverrideItem = PricingItemExtended;
type OverrideConfig = PricingItemConfigExtended;

type MergeOptions = {
    /**
     * Whether parts of the original that the override does not mention should be dropped. Set for
     * an `ALL` override, which replaces what it covers rather than adding to it.
     */
    dropUnmatched: boolean;
};

/** The original a pricing was cloned from, or its own id when it is the original. */
const getOriginalPricingId = (pricing: Pick<Pricing, 'id' | 'original_pricing_id'>): string =>
    pricing.original_pricing_id ?? pricing.id;

const getOriginalItemId = (item: Pick<PricingItemExtended, 'id' | 'original_pricing_item_id'>) =>
    item.original_pricing_item_id ?? item.id;

const getOriginalConfigId = (
    config: Pick<PricingItemConfigExtended, 'id' | 'original_pricing_item_config_id'>,
) => config.original_pricing_item_config_id ?? config.id;

const isSameBillingPeriod = (left?: BillingPeriod, right?: BillingPeriod): boolean =>
    left?.type === right?.type && left?.value === right?.value;

/**
 * Drop the keys an override leaves empty so spreading it over the original only replaces what it
 * actually carries. The unsaved override shapes spell optional fields out as `undefined`, which
 * would otherwise blank out the original's value.
 */
function definedValues<T extends object>(value: T): Partial<T> {
    const result: Partial<T> = {};

    for (const key in value) {
        if (value[key] !== undefined) {
            result[key] = value[key];
        }
    }

    return result;
}

function mergeConfigs(
    baseConfigs: PricingItemConfigExtended[] | undefined,
    overrideConfigs: OverrideConfig[] | undefined,
    options: MergeOptions,
): PricingItemConfigExtended[] | undefined {
    if (!overrideConfigs?.length) {
        return baseConfigs;
    }

    if (!baseConfigs?.length) {
        return overrideConfigs;
    }

    const applied = new Set<OverrideConfig>();
    const merged = baseConfigs.reduce<PricingItemConfigExtended[]>((accumulator, baseConfig) => {
        const overrideConfig = overrideConfigs.find(
            (config) => getOriginalConfigId(config) === getOriginalConfigId(baseConfig),
        );

        if (!overrideConfig) {
            return options.dropUnmatched ? accumulator : [...accumulator, baseConfig];
        }

        applied.add(overrideConfig);

        return [...accumulator, mergeConfig(baseConfig, overrideConfig)];
    }, []);

    // Configs the override introduces — a tier or condition the plan does not have — match nothing
    // to merge into and are appended in the order the override lists them.
    return [...merged, ...overrideConfigs.filter((config) => !applied.has(config))];
}

function mergeBillingPeriodConfigs(
    baseConfigs: PricingItemConfigBillingPeriodConfig<PricingItemConfigExtended>[] | undefined,
    overrideConfigs: PricingItemConfigBillingPeriodConfig<OverrideConfig>[] | undefined,
    options: MergeOptions,
): PricingItemConfigBillingPeriodConfig<PricingItemConfigExtended>[] | undefined {
    if (!overrideConfigs?.length) {
        return baseConfigs;
    }

    if (!baseConfigs?.length) {
        return overrideConfigs;
    }

    return [
        ...baseConfigs.map((baseConfig) => {
            const overrideConfig = overrideConfigs.find((config) =>
                isSameBillingPeriod(config.billing_period, baseConfig.billing_period),
            );

            return overrideConfig
                ? {
                      ...baseConfig,
                      configs:
                          mergeConfigs(baseConfig.configs, overrideConfig.configs, options) ?? [],
                  }
                : baseConfig;
        }),
        ...overrideConfigs.filter(
            (overrideConfig) =>
                !baseConfigs.some((baseConfig) =>
                    isSameBillingPeriod(overrideConfig.billing_period, baseConfig.billing_period),
                ),
        ),
    ];
}

function mergeCurrencyConfigs(
    baseConfigs: PricingCurrencyConfig<PricingItemConfigExtended>[] | undefined,
    overrideConfigs: PricingCurrencyConfig<OverrideConfig>[] | undefined,
    options: MergeOptions,
): PricingCurrencyConfig<PricingItemConfigExtended>[] | undefined {
    if (!overrideConfigs?.length) {
        return baseConfigs;
    }

    if (!baseConfigs?.length) {
        return overrideConfigs;
    }

    return [
        ...baseConfigs.map((baseConfig) => {
            const overrideConfig = overrideConfigs.find(
                (config) => config.currency === baseConfig.currency,
            );

            return overrideConfig
                ? {
                      ...baseConfig,
                      ...definedValues(overrideConfig),
                      configs: mergeConfigs(baseConfig.configs, overrideConfig.configs, options),
                      billing_period_configs: mergeBillingPeriodConfigs(
                          baseConfig.billing_period_configs,
                          overrideConfig.billing_period_configs,
                          options,
                      ),
                  }
                : baseConfig;
        }),
        ...overrideConfigs.filter(
            (overrideConfig) =>
                !baseConfigs.some((baseConfig) => baseConfig.currency === overrideConfig.currency),
        ),
    ];
}

function mergeConfig(
    baseConfig: PricingItemConfigExtended,
    overrideConfig: OverrideConfig,
): PricingItemConfigExtended {
    // A config override always spells the whole config out, so the nested lists are merged rather
    // than replaced only to keep the expanded data (meter property names) the override drops.
    const options: MergeOptions = { dropUnmatched: false };

    return {
        ...baseConfig,
        ...definedValues(overrideConfig),
        // The customized config is the one the rest of the schedule points at — markups reference
        // it by id, and so do `included_volumes` and `seats_values`.
        id: overrideConfig.id ?? baseConfig.id,
        original_pricing_item_config_id: getOriginalConfigId(baseConfig),
        conditions:
            baseConfig.conditions && overrideConfig.conditions
                ? {
                      ...baseConfig.conditions,
                      ...definedValues(overrideConfig.conditions),
                      // Only the expanded version names the meter properties a condition reads.
                      meter_properties:
                          baseConfig.conditions.meter_properties ??
                          overrideConfig.conditions.meter_properties,
                      configs: mergeConfigs(
                          baseConfig.conditions.configs,
                          overrideConfig.conditions.configs,
                          options,
                      ),
                  }
                : (overrideConfig.conditions ?? baseConfig.conditions),
        billing_period_configs: mergeBillingPeriodConfigs(
            baseConfig.billing_period_configs,
            overrideConfig.billing_period_configs,
            options,
        ),
    };
}

function mergeItem(baseItem: PricingItemExtended, overrideItem: OverrideItem): PricingItemExtended {
    const options: MergeOptions = { dropUnmatched: overrideItem.override === 'ALL' };

    return {
        ...baseItem,
        ...definedValues(overrideItem),
        id: overrideItem.id ?? baseItem.id,
        original_pricing_item_id: getOriginalItemId(baseItem),
        // Product items are expanded onto the plan version only; an override never repeats them.
        product_items: baseItem.product_items,
        configs: mergeConfigs(baseItem.configs, overrideItem.configs, options),
        billing_period_configs: mergeBillingPeriodConfigs(
            baseItem.billing_period_configs,
            overrideItem.billing_period_configs,
            options,
        ),
        pricing_currency_configs: mergeCurrencyConfigs(
            baseItem.pricing_currency_configs,
            overrideItem.pricing_currency_configs,
            options,
        ),
    };
}

function mergeItems(
    baseItems: PricingItemExtended[] | undefined,
    overrideItems: OverrideItem[] | undefined,
    options: MergeOptions,
): PricingItemExtended[] | undefined {
    if (!overrideItems?.length) {
        return baseItems;
    }

    if (!baseItems?.length) {
        return overrideItems;
    }

    const applied = new Set<OverrideItem>();
    const merged = baseItems.reduce<PricingItemExtended[]>((accumulator, baseItem) => {
        const overrideItem = overrideItems.find(
            (item) => getOriginalItemId(item) === getOriginalItemId(baseItem),
        );

        if (!overrideItem) {
            return options.dropUnmatched ? accumulator : [...accumulator, baseItem];
        }

        applied.add(overrideItem);

        return [...accumulator, mergeItem(baseItem, overrideItem)];
    }, []);

    return [...merged, ...overrideItems.filter((item) => !applied.has(item))];
}

function mergeEntitlements(
    baseEntitlements: EntitlementExtended[] | undefined,
    overrideEntitlements: EntitlementExtended[] | undefined,
): EntitlementExtended[] | undefined {
    if (!overrideEntitlements?.length) {
        return baseEntitlements;
    }

    // The feature an entitlement describes is expanded onto the plan version only, and it is what
    // the entitlement is labelled with, so it is carried over from the original.
    return overrideEntitlements.map((entitlement) => {
        const feature = baseEntitlements?.find(
            (baseEntitlement) => baseEntitlement.feature_id === entitlement.feature_id,
        )?.feature;

        return feature ? { ...entitlement, feature } : entitlement;
    });
}

function mergePricing(
    basePricing: PricingExtended,
    overridePricing: OverridePricing,
): PricingExtended {
    const options: MergeOptions = { dropUnmatched: overridePricing.override === 'ALL' };

    return {
        ...basePricing,
        ...definedValues(overridePricing),
        // The customized pricing takes over the original's place, so it has to answer to the id the
        // schedule enables it under — `getEnabledPricingIds` returns the override's id, and add-ons
        // not matching one of those are filtered out of the rendered plan version.
        id: overridePricing.id ?? basePricing.id,
        original_pricing_id: getOriginalPricingId(basePricing),
        // Products are expanded onto the plan version only; an override never repeats them.
        products: basePricing.products,
        entitlements: mergeEntitlements(basePricing.entitlements, overridePricing.entitlements),
        items: mergeItems(basePricing.items, overridePricing.items, options),
    };
}

function withOverridesApplied(
    pricings: PricingExtended[],
    overridePricings: OverridePricing[],
): PricingExtended[] {
    return pricings.map((pricing) => {
        const overridePricing = overridePricings.find(
            (override) => override.original_pricing_id === getOriginalPricingId(pricing),
        );

        return overridePricing ? mergePricing(pricing, overridePricing) : pricing;
    });
}

/**
 * The plan version as the schedule actually bills it: the version's own pricings with the
 * schedule's `override_pricings` merged in, which is what the API calls the combined version.
 *
 * An override that matches no pricing in the version is skipped rather than appended — it has no
 * category to be shown under, and in practice it means the override outlived the pricing it was
 * cloned from.
 */
export function combinePricingPlanVersionWithOverrides({
    pricingPlanVersion,
    overridePricings,
}: {
    pricingPlanVersion: PricingPlanVersionExtended;
    overridePricings: PricingPlanSchedule['override_pricings'];
}): PricingPlanVersionExtended {
    // Reading through the saved shape: see the note on `OverridePricing`.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const overrides = (overridePricings ?? []) as OverridePricing[];

    if (!overrides.length) {
        return pricingPlanVersion;
    }

    return {
        ...pricingPlanVersion,
        pricing_categories: pricingPlanVersion.pricing_categories?.map(
            (category): PricingCategoryExtended => ({
                ...category,
                pricings: category.pricings && withOverridesApplied(category.pricings, overrides),
                pricing_groups: category.pricing_groups?.map((group) => ({
                    ...group,
                    pricings: withOverridesApplied(group.pricings, overrides),
                })),
            }),
        ),
    };
}

/**
 * Turn an expanded subscription into what `PricingPlanSchedules` renders, with each schedule's
 * price customizations merged into the plan version it shows.
 */
export function getSchedulesWithPlanData(
    subscription: PricingPlanSubscriptionExpanded,
): PricingPlanScheduleWithPlanData[] {
    return subscription.pricing_plan_schedule_infos.map((scheduleInfo) => ({
        schedule: scheduleInfo.pricing_plan_schedule,
        selectedPricingPlan: scheduleInfo.pricing_plan_version.pricing_plan,
        selectedPricingPlanVersion: combinePricingPlanVersionWithOverrides({
            pricingPlanVersion: scheduleInfo.pricing_plan_version,
            overridePricings: scheduleInfo.pricing_plan_schedule?.override_pricings,
        }),
    }));
}
