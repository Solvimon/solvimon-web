import type {
    ConfiguredMeterValue,
    PricingItemConfig,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import { getPricingsFromScheduleInfo } from './pricing';
import { getPricingItemConfigs } from './pricingItem';

/** What a one-off flat item's quantity falls back to when neither the schedule nor the plan names one. */
export const FALLBACK_UNITS_NUMBER = '1';

/**
 * The quantity the plan itself defines per pricing item config, which is what a schedule listing
 * a units config without a number of its own is priced on.
 */
function getDefaultUnitsNumbersById(
    scheduleInfo: PricingPlanScheduleInfoExpanded,
): Map<PricingItemConfig['id'], string> {
    const configs = getPricingsFromScheduleInfo(scheduleInfo)
        .flatMap((pricing) => pricing.items ?? [])
        .flatMap(getPricingItemConfigs);

    return new Map(
        configs.flatMap((config) =>
            config.default_units?.number ? [[config.id, config.default_units.number] as const] : [],
        ),
    );
}

/**
 * The one-off flat item quantities a subscription starts from, with a number filled in for every
 * units config.
 *
 * A schedule the customer has not customized yet lists its units configs without a number, and the
 * count they are shown then comes from the plan's own `default_units`. That default has to be part
 * of the form state too, since everything the checkout sends out is built from it — an invoice
 * preview of a units entry without a number is rejected, and a subscription created from one would
 * be priced on a quantity the customer never agreed to.
 */
export function getInitialUnitsValues(
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
): ConfiguredMeterValue[] | undefined {
    const unitsValues = scheduleInfo?.pricing_plan_schedule?.units;

    if (!scheduleInfo || !unitsValues?.length) {
        return undefined;
    }

    const defaultNumbers = scheduleInfo.pricing_plan_version
        ? getDefaultUnitsNumbersById(scheduleInfo)
        : new Map<PricingItemConfig['id'], string>();

    return unitsValues.map(({ pricing_item_config_id, number }) => ({
        pricing_item_config_id,
        number: number || defaultNumbers.get(pricing_item_config_id) || FALLBACK_UNITS_NUMBER,
    }));
}
