import type {
    ConfiguredMeterValue,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import { getPricingsFromScheduleInfo } from './pricing';
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
 */
export function getInitialMeterValues(
    kind: keyof typeof METER_KEYS,
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
): ConfiguredMeterValue[] | undefined {
    const keys = METER_KEYS[kind];
    const meterValues = scheduleInfo?.pricing_plan_schedule?.[keys.schedule];

    if (!scheduleInfo || !meterValues?.length) {
        return undefined;
    }

    const configs = scheduleInfo.pricing_plan_version
        ? getPricingsFromScheduleInfo(scheduleInfo)
              .flatMap((pricing) => pricing.items ?? [])
              .flatMap(getPricingItemConfigs)
        : [];
    const defaultNumbers = new Map(
        configs.flatMap((config) => {
            const number = config[keys.planDefault]?.number;
            return number ? [[config.id, number] as const] : [];
        }),
    );

    return meterValues.map(({ pricing_item_config_id, number }) => ({
        pricing_item_config_id,
        number: number || defaultNumbers.get(pricing_item_config_id) || FALLBACK_METER_NUMBER,
    }));
}
