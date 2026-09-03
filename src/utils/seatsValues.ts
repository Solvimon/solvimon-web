import type {
    ConfiguredMeterValue,
    PricingItemConfig,
    PricingItemConfigBillingPeriodConfig,
    PricingItemExtended,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import { getPricingsFromScheduleInfo } from './pricing';

/** What a seat count falls back to when neither the schedule nor the plan names one. */
export const FALLBACK_SEATS_NUMBER = '1';

const getConfigsOfBillingPeriods = (
    billingPeriodConfigs: PricingItemConfigBillingPeriodConfig<PricingItemConfig>[] | undefined,
): PricingItemConfig[] =>
    (billingPeriodConfigs ?? []).flatMap(
        (billingPeriodConfig) => billingPeriodConfig.configs ?? [],
    );

/**
 * Every config of a pricing item. Which of the three lists holds them depends on the plan: one
 * price for everyone sits directly on the item, and a price per currency or per billing period
 * sits one or two levels down.
 */
const getPricingItemConfigs = (item: PricingItemExtended): PricingItemConfig[] => [
    ...(item.configs ?? []),
    ...getConfigsOfBillingPeriods(item.billing_period_configs),
    ...(item.pricing_currency_configs ?? []).flatMap((currencyConfig) => [
        ...(currencyConfig.configs ?? []),
        ...getConfigsOfBillingPeriods(currencyConfig.billing_period_configs),
    ]),
];

/**
 * The seat count the plan itself defines per pricing item config, which is what a schedule listing
 * a seat config without a number of its own is priced on.
 */
function getDefaultSeatsNumbersById(
    scheduleInfo: PricingPlanScheduleInfoExpanded,
): Map<PricingItemConfig['id'], string> {
    const configs = getPricingsFromScheduleInfo(scheduleInfo)
        .flatMap((pricing) => pricing.items ?? [])
        .flatMap(getPricingItemConfigs);

    return new Map(
        configs.flatMap((config) =>
            config.default_seats_value?.number
                ? [[config.id, config.default_seats_value.number] as const]
                : [],
        ),
    );
}

/**
 * The seats a subscription starts from, with a number filled in for every seat config.
 *
 * A schedule the customer has not customized yet lists its seat configs without a number, and the
 * count they are shown then comes from the plan's own `default_seats_value`. That default has to be
 * part of the form state too, since everything the checkout sends out is built from it — an invoice
 * preview of a seat without a number is rejected, and a subscription created from one would be
 * priced on seats the customer never agreed to.
 */
export function getInitialSeatsValues(
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
): ConfiguredMeterValue[] | undefined {
    const seatsValues = scheduleInfo?.pricing_plan_schedule?.seats_values;

    if (!scheduleInfo || !seatsValues?.length) {
        return undefined;
    }

    const defaultNumbers = scheduleInfo.pricing_plan_version
        ? getDefaultSeatsNumbersById(scheduleInfo)
        : new Map<PricingItemConfig['id'], string>();

    return seatsValues.map(({ pricing_item_config_id, number }) => ({
        pricing_item_config_id,
        number: number || defaultNumbers.get(pricing_item_config_id) || FALLBACK_SEATS_NUMBER,
    }));
}
