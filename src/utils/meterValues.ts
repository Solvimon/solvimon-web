import type {
    ConfiguredMeterValue,
    Pricing,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import { getPricingsWithGroupsFromScheduleInfo, isOptionalPricing } from './pricing';
import { getPricingItemConfigs } from './pricingItem';

/** What a seat count or a one-off flat item's quantity falls back to when nothing names one. */
export const FALLBACK_METER_NUMBER = '1';

const METER_KEYS = {
    seats: { schedule: 'seats_values', planDefault: 'default_seats_value' },
    units: { schedule: 'units', planDefault: 'default_units' },
} as const;

/**
 * The seats or one-off flat item units a subscription starts from, with a number filled in for
 * every config.
 *
 * A schedule the customer has not customized yet lists its configs without a number, and the count
 * they are shown then comes from the plan's own default (`default_seats_value` / `default_units`).
 * That default has to be part of the form state too, since everything the checkout sends out is
 * built from it — an invoice preview of an entry without a number is rejected, and a subscription
 * created from one would be priced on a quantity the customer never agreed to.
 *
 * The schedule lists no seats for an addon or group member that is not enabled on it yet, so the
 * seat-based configs of those are added with their plan default, for when the customer picks one.
 */
export function getInitialMeterValues(
    kind: keyof typeof METER_KEYS,
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
): ConfiguredMeterValue[] | undefined {
    const keys = METER_KEYS[kind];
    const meterValues = scheduleInfo?.pricing_plan_schedule?.[keys.schedule] ?? [];

    if (!scheduleInfo) {
        return undefined;
    }

    const pricings = scheduleInfo.pricing_plan_version
        ? getPricingsWithGroupsFromScheduleInfo(scheduleInfo)
        : [];
    const configs = pricings
        .flatMap((pricing) => pricing.items ?? [])
        .flatMap(getPricingItemConfigs);
    const defaultNumbers = new Map(
        configs.flatMap((config) => {
            const number = config[keys.planDefault]?.number;
            return number ? [[config.id, number] as const] : [];
        }),
    );

    const listedIds = new Set(
        meterValues.map(({ pricing_item_config_id }) => pricing_item_config_id),
    );
    const unlistedSeatConfigIds =
        kind === 'seats'
            ? pricings
                  .filter(isOptionalPricing)
                  .flatMap((pricing) => pricing.items ?? [])
                  .filter((item) =>
                      item.product_items?.some(({ model_type }) => model_type === 'PER_SEAT'),
                  )
                  .flatMap(getPricingItemConfigs)
                  .map(({ id }) => id)
                  .filter((id) => !listedIds.has(id))
            : [];

    const result = [
        ...meterValues,
        ...unlistedSeatConfigIds.map((id) => ({ pricing_item_config_id: id })),
    ].map(({ pricing_item_config_id, number }: ConfiguredMeterValue) => ({
        pricing_item_config_id,
        number: number || defaultNumbers.get(pricing_item_config_id) || FALLBACK_METER_NUMBER,
    }));

    return result.length ? result : undefined;
}

/**
 * Drops the entries of an addon or group member the customer has not picked: those are not
 * billed, so they are neither shown nor sent.
 */
export function getMeterValuesOfEnabledPricings(
    meterValues: ConfiguredMeterValue[] | undefined,
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
    enabledPricingIds: Pricing['id'][] | undefined,
): ConfiguredMeterValue[] | undefined {
    if (!meterValues || !scheduleInfo?.pricing_plan_version) {
        return meterValues;
    }

    const unpickedConfigIds = new Set(
        getPricingsWithGroupsFromScheduleInfo(scheduleInfo)
            .filter(
                (pricing) => isOptionalPricing(pricing) && !enabledPricingIds?.includes(pricing.id),
            )
            .flatMap((pricing) => pricing.items ?? [])
            .flatMap(getPricingItemConfigs)
            .map(({ id }) => id),
    );

    const billed = meterValues.filter(
        ({ pricing_item_config_id }) => !unpickedConfigIds.has(pricing_item_config_id),
    );

    // An empty list asks the API to reset every count, which it refuses outside a draft.
    return billed.length ? billed : undefined;
}
