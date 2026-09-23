import type {
    PricingExtended,
    PricingItemConfig,
    PricingItemConfigBillingPeriodConfig,
    PricingItemExtended,
} from '@solvimon/solvimon-types';

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
export const getPricingItemConfigs = (item: PricingItemExtended): PricingItemConfig[] => [
    ...(item.configs ?? []),
    ...getConfigsOfBillingPeriods(item.billing_period_configs),
    ...(item.pricing_currency_configs ?? []).flatMap((currencyConfig) => [
        ...(currencyConfig.configs ?? []),
        ...getConfigsOfBillingPeriods(currencyConfig.billing_period_configs),
    ]),
];

export function getPricingItemByPricingConfigId({
    pricings,
    pricingItemConfigId,
}: {
    pricings: PricingExtended[];
    pricingItemConfigId: PricingItemConfig['id'];
}) {
    const pricingItem: PricingItemExtended | undefined = pricings
        .flatMap((pricing) => pricing.items ?? [])
        .find((item) => item.configs?.some((config) => config.id === pricingItemConfigId));

    const config = pricingItem?.configs?.find((config) => config.id === pricingItemConfigId);
    const productItem = pricingItem?.product_items?.[0];

    return {
        config,
        productItem,
    };
}
