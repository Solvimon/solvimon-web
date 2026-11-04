import type {
    ConfiguredMeterValue,
    Pricing,
    PricingExtended,
    PricingItemConfig,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { getAllPricingsFromScheduleInfos } from './pricing';
import { getPricingItemConfigs } from './pricingItem';
import { getPricingGroupsFromExtendedPricingPlanSubscription } from './subscription';

export interface AddonSelection {
    enabledPricingIds: Pricing['id'][];
    seatsValues: ConfiguredMeterValue[];
    unitsValues: ConfiguredMeterValue[];
}

/**
 * The configs an add-on's quantity is set on: its per-seat items as seats and its one-off flat
 * items as units. Every config of an item is listed, as the form keeps values for all currencies
 * and billing periods and shows only those on offer.
 */
export function getAddonQuantityConfigIds(pricing: PricingExtended): {
    seats: Set<PricingItemConfig['id']>;
    units: Set<PricingItemConfig['id']>;
} {
    const seats = new Set<PricingItemConfig['id']>();
    const units = new Set<PricingItemConfig['id']>();

    for (const item of pricing.items ?? []) {
        const modelType = item.product_items?.[0]?.model_type;
        for (const config of getPricingItemConfigs(item)) {
            if (modelType === 'PER_SEAT') {
                seats.add(config.id);
            } else if (modelType === 'ONE_OFF' && config.details?.pricing_type === 'FLAT') {
                units.add(config.id);
            }
        }
    }

    return { seats, units };
}

export function isQuantityAddon(pricing: PricingExtended): boolean {
    const { seats, units } = getAddonQuantityConfigIds(pricing);
    return seats.size > 0 || units.size > 0;
}

/**
 * The fewest the add-on can be bought in: the plan's default seats or units, which is also where its
 * stepper starts. The API has no separate minimum, and a missing default means 1.
 */
export function getAddonMinimumQuantity(pricing: PricingExtended): number {
    const defaults = (pricing.items ?? []).flatMap((item) => {
        const modelType = item.product_items?.[0]?.model_type;
        return getPricingItemConfigs(item).map((config) =>
            Number(
                modelType === 'PER_SEAT'
                    ? config.default_seats_value?.number
                    : modelType === 'ONE_OFF' && config.details?.pricing_type === 'FLAT'
                      ? config.default_units?.number
                      : undefined,
            ),
        );
    });

    return Math.max(1, ...defaults.filter((number) => number > 0));
}

/** 0 while the add-on is not in the order. */
export function getAddonQuantity(pricing: PricingExtended, selection: AddonSelection): number {
    if (!selection.enabledPricingIds.includes(pricing.id)) return 0;

    const { seats, units } = getAddonQuantityConfigIds(pricing);
    const value = [...selection.seatsValues, ...selection.unitsValues].find(
        ({ pricing_item_config_id }) =>
            seats.has(pricing_item_config_id) || units.has(pricing_item_config_id),
    );

    return Number(value?.number) || 1;
}

/**
 * A quantity below the add-on's minimum takes it out of the order, along with its seats and units,
 * so stepping down from the minimum goes straight back to the add button.
 */
export function setAddonQuantity(
    pricing: PricingExtended,
    requestedQuantity: number,
    selection: AddonSelection,
): AddonSelection {
    const quantity = requestedQuantity < getAddonMinimumQuantity(pricing) ? 0 : requestedQuantity;
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

/** Every add-on pricing of the subscription, on its own or in an add-on group. */
export function getAddonPricings(subscription: PricingPlanSubscriptionExpanded): PricingExtended[] {
    // A schedule info may come without its version, and then has no pricings to offer.
    const scheduleInfos = subscription.pricing_plan_schedule_infos.filter(
        (info) => info.pricing_plan_version,
    );

    return [
        ...getAllPricingsFromScheduleInfos(scheduleInfos).filter(
            (pricing) => pricing.product_type === 'ADDON',
        ),
        ...getPricingGroupsFromExtendedPricingPlanSubscription({
            ...subscription,
            pricing_plan_schedule_infos: scheduleInfos,
        })
            .filter((group) => group.product_type === 'ADDON')
            .flatMap((group) => group.pricings ?? []),
    ];
}

/** The seat and unit configs of the given add-ons, for telling their values from the plan's own. */
export function getAddonConfigIds(pricings: PricingExtended[]): Set<PricingItemConfig['id']> {
    return new Set(
        pricings.flatMap((pricing) => {
            const { seats, units } = getAddonQuantityConfigIds(pricing);
            return [...seats, ...units];
        }),
    );
}
