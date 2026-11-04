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

/** Whether a config of the item is bought in seats, in units (a one-off flat item), or neither. */
export function getMeterKind(
    item: PricingItemExtended,
    config: PricingItemConfig | undefined,
): keyof typeof METER_KEYS | undefined {
    const modelType = item.product_items?.[0]?.model_type;
    if (modelType === 'PER_SEAT') return 'seats';
    if (modelType === 'ONE_OFF' && config?.details?.pricing_type === 'FLAT') return 'units';
    return undefined;
}

/**
 * The configs an add-on's quantity is set on. Every config of an item is listed, as the form keeps
 * values for all currencies and billing periods and shows only those on offer.
 */
export function getAddonQuantityConfigIds(pricing: PricingExtended): {
    seats: Set<PricingItemConfig['id']>;
    units: Set<PricingItemConfig['id']>;
} {
    const ids = { seats: new Set<string>(), units: new Set<string>() };

    for (const item of pricing.items ?? []) {
        for (const config of getPricingItemConfigs(item)) {
            const kind = getMeterKind(item, config);
            if (kind) ids[kind].add(config.id);
        }
    }

    return ids;
}

const configIdsOf = (pricing: PricingExtended): PricingItemConfig['id'][] => {
    const { seats, units } = getAddonQuantityConfigIds(pricing);
    return [...seats, ...units];
};

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
        const configIds = configIdsOf(pricing);
        return configIds.length > 0 && !configIds.some((id) => orderConfigIds.has(id));
    });
}

/** The seat and unit configs of the given add-ons, for telling their values from the plan's own. */
export function getAddonConfigIds(pricings: PricingExtended[]): Set<PricingItemConfig['id']> {
    return new Set(pricings.flatMap(configIdsOf));
}

/**
 * The fewest the add-on can be bought in: the plan's default seats or units for the currency and
 * billing period on offer, which is also where its stepper starts. The API has no separate minimum.
 */
export function getAddonMinimumQuantity(
    pricing: PricingExtended,
    offer: { currency?: Currency['currencyCode']; billingPeriod?: BillingPeriod } = {},
): number {
    const defaults = (pricing.items ?? []).map((item) => {
        const config = getConfigFromPricingItem({ pricingItem: item, ...offer });
        const kind = getMeterKind(item, config);
        return kind ? Number(config?.[METER_KEYS[kind].planDefault]?.number) : NaN;
    });

    return Math.max(Number(FALLBACK_METER_NUMBER), ...defaults.filter((number) => number > 0));
}

/** 0 while the add-on is not in the order, and `fallback` while it is in it without a value. */
export function getAddonQuantity(
    pricing: PricingExtended,
    selection: AddonSelection,
    fallback: number,
): number {
    if (!selection.enabledPricingIds.includes(pricing.id)) return 0;

    const { seats, units } = getAddonQuantityConfigIds(pricing);
    const value = [...selection.seatsValues, ...selection.unitsValues].find(
        ({ pricing_item_config_id }) =>
            seats.has(pricing_item_config_id) || units.has(pricing_item_config_id),
    );

    return Number(value?.number) || fallback;
}

/** A quantity of 0 takes the add-on out of the order, along with its seats and units. */
export function setAddonQuantity(
    pricing: PricingExtended,
    quantity: number,
    selection: AddonSelection,
): AddonSelection {
    const { seats, units } = getAddonQuantityConfigIds(pricing);
    const number = String(quantity);
    const withQuantity = (values: ConfiguredMeterValue[], configIds: Set<string>) => [
        ...values.filter(({ pricing_item_config_id }) => !configIds.has(pricing_item_config_id)),
        ...(quantity > 0
            ? [...configIds].map((pricing_item_config_id) => ({ pricing_item_config_id, number }))
            : []),
    ];
    const otherPricingIds = selection.enabledPricingIds.filter((id) => id !== pricing.id);

    return {
        enabledPricingIds:
            quantity <= 0
                ? otherPricingIds
                : selection.enabledPricingIds.includes(pricing.id)
                  ? selection.enabledPricingIds
                  : [...otherPricingIds, pricing.id],
        seatsValues: withQuantity(selection.seatsValues, seats),
        unitsValues: withQuantity(selection.unitsValues, units),
    };
}
