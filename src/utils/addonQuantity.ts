import type {
    BillingPeriod,
    ConfiguredMeterValue,
    Currency,
    Pricing,
    PricingExtended,
    PricingItemConfig,
    PricingItemExtended,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { getConfigFromPricingItem } from '@solvimon/solvimon-ui';
import { FALLBACK_METER_NUMBER, METER_KEYS } from './meterValues';
import { getAllPricingsFromScheduleInfos } from './pricing';
import { getPricingItemConfigs } from './pricingItem';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from './subscription';

export interface AddonSelection {
    enabledPricingIds: Pricing['id'][];
    seatsValues: ConfiguredMeterValue[];
    unitsValues: ConfiguredMeterValue[];
}

/** The currency and billing period on offer, which pick each item's config. */
export interface AddonOffer {
    currency?: Currency['currencyCode'];
    billingPeriod?: BillingPeriod;
}

type MeterKind = keyof typeof METER_KEYS;

interface AddonConfig {
    kind: MeterKind;
    id: PricingItemConfig['id'];
    /** The plan's default seats or units, or NaN when it names none. */
    defaultNumber: number;
}

/** Whether a config of the item is bought in seats, in units (a one-off flat item), or neither. */
export function getMeterKind(
    item: PricingItemExtended,
    config: PricingItemConfig | undefined,
): MeterKind | undefined {
    const modelType = item.product_items?.[0]?.model_type;
    if (modelType === 'PER_SEAT') return 'seats';
    if (modelType === 'ONE_OFF' && config?.details?.pricing_type === 'FLAT') return 'units';
    return undefined;
}

/** The add-on's seat and unit configs: with an offer, only each item's config on offer. */
function getAddonConfigs(pricing: PricingExtended, offer?: AddonOffer): AddonConfig[] {
    return (pricing.items ?? []).flatMap((item) => {
        const configs = offer
            ? [getConfigFromPricingItem({ pricingItem: item, ...offer })]
            : getPricingItemConfigs(item);

        return configs.flatMap((config) => {
            const kind = getMeterKind(item, config);
            return config && kind
                ? [
                      {
                          kind,
                          id: config.id,
                          defaultNumber: Number(config[METER_KEYS[kind].planDefault]?.number),
                      },
                  ]
                : [];
        });
    });
}

/**
 * What the add-on's stepper counts: its seats when it has per-seat items, and otherwise the units of
 * its one-off flat items. A one-off item next to per-seat ones is bought in its own default units.
 */
const steppedKind = (configs: AddonConfig[]): MeterKind =>
    configs.some(({ kind }) => kind === 'seats') ? 'seats' : 'units';

/**
 * The add-ons the add-on editor sets a quantity on: those with seats or units, on their own or in a
 * pick-any group. One the order already gives seats or units of its own stays with the plan's
 * steppers, which keep the customer at the order's quantity.
 */
export function getQuantityAddons(
    subscription: PricingPlanSubscriptionExpanded,
    orderValues: ConfiguredMeterValue[] = [],
): PricingExtended[] {
    // A schedule info may come without its version, and then has no pricings to offer.
    const scheduleInfos = subscription.pricing_plan_schedule_infos.filter(
        (info) => info.pricing_plan_version,
    );
    const orderConfigIds = new Set(orderValues.map((value) => value.pricing_item_config_id));
    const addons = [
        ...getAllPricingsFromScheduleInfos(scheduleInfos).filter(
            (pricing) => pricing.product_type === 'ADDON',
        ),
        ...getPricingGroupsFromExtendedPricingPlanSubscription({
            ...subscription,
            pricing_plan_schedule_infos: scheduleInfos,
        })
            .filter(
                (group) => group.product_type === 'ADDON' && group.selection_constraint === 'ANY',
            )
            .flatMap((group) => group.pricings ?? []),
    ];

    return addons.filter((pricing) => {
        const configs = getAddonConfigs(pricing);
        return configs.length > 0 && !configs.some(({ id }) => orderConfigIds.has(id));
    });
}

/** The seat and unit configs of the given add-ons, for telling their values from the plan's own. */
export function getAddonConfigIds(pricings: PricingExtended[]): Set<PricingItemConfig['id']> {
    return new Set(pricings.flatMap((pricing) => getAddonConfigs(pricing).map(({ id }) => id)));
}

/**
 * The fewest the add-on can be bought in: the plan's default for what its stepper counts, on
 * offer, which is also where the stepper starts. The API has no separate minimum.
 */
export function getAddonMinimumQuantity(pricing: PricingExtended, offer: AddonOffer = {}): number {
    const configs = getAddonConfigs(pricing, offer);
    const kind = steppedKind(configs);
    const defaults = configs
        .filter((config) => config.kind === kind && config.defaultNumber > 0)
        .map(({ defaultNumber }) => defaultNumber);

    return Math.max(Number(FALLBACK_METER_NUMBER), ...defaults);
}

/**
 * 0 while the add-on is not in the order, and undefined while it is in it without a value for
 * what its stepper counts.
 */
export function getAddonQuantity(
    pricing: PricingExtended,
    selection: AddonSelection,
): number | undefined {
    if (!selection.enabledPricingIds.includes(pricing.id)) return 0;

    const configs = getAddonConfigs(pricing);
    const kind = steppedKind(configs);
    const ids = new Set(configs.filter((config) => config.kind === kind).map(({ id }) => id));
    const value = selection[`${kind}Values`].find(({ pricing_item_config_id }) =>
        ids.has(pricing_item_config_id),
    );

    return Number(value?.number) || undefined;
}

/**
 * Sets the add-on's quantity on its configs on offer, after clearing all of its configs. A quantity
 * of 0 takes the add-on out of the order, along with its seats and units.
 */
export function setAddonQuantity(
    pricing: PricingExtended,
    quantity: number,
    selection: AddonSelection,
    offer: AddonOffer = {},
): AddonSelection {
    const allIds = getAddonConfigIds([pricing]);
    const offered = quantity > 0 ? getAddonConfigs(pricing, offer) : [];
    const kind = steppedKind(offered);
    const withQuantity = (values: ConfiguredMeterValue[], valuesKind: MeterKind) => [
        ...values.filter(({ pricing_item_config_id }) => !allIds.has(pricing_item_config_id)),
        ...offered
            .filter((config) => config.kind === valuesKind)
            .map(({ id, defaultNumber }) => ({
                pricing_item_config_id: id,
                number: String(
                    valuesKind === kind
                        ? quantity
                        : defaultNumber > 0
                          ? defaultNumber
                          : FALLBACK_METER_NUMBER,
                ),
            })),
    ];
    const otherPricingIds = selection.enabledPricingIds.filter((id) => id !== pricing.id);

    return {
        enabledPricingIds:
            quantity <= 0
                ? otherPricingIds
                : selection.enabledPricingIds.includes(pricing.id)
                  ? selection.enabledPricingIds
                  : [...otherPricingIds, pricing.id],
        seatsValues: withQuantity(selection.seatsValues, 'seats'),
        unitsValues: withQuantity(selection.unitsValues, 'units'),
    };
}
