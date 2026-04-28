import type { PricingExtended, PricingItemConfig, PricingItemExtended } from '@solvimon/solvimon-types';

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
