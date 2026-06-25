import type { Amount, BillingPeriod, PricingExtended, PricingItemConfig } from '@solvimon/solvimon-types';
import { computed, type ComputedRef } from 'vue';
import { getPricingItemByPricingConfigId } from '@/utils/pricingItem';

export function useSeatBasedPricing({
    pricings,
    pricingItemConfigId,
}: {
    pricings: PricingExtended[];
    pricingItemConfigId: PricingItemConfig['id'];
}): ComputedRef<{
    billing: {
        period?: BillingPeriod;
        billedInAdvance?: boolean;
    };
    product: {
        name?: string;
        description?: string;
    };
    pricing: {
        amount?: Amount;
        tiered?: {
            bands: NonNullable<PricingItemConfig['details']>['bands'];
        };
    };
}> {
    return computed(() => {
        const { config, productItem } = getPricingItemByPricingConfigId({
            pricings,
            pricingItemConfigId,
        });

        return {
            billing: {
                period: config?.billing_period_configs?.[0]?.billing_period,
                billedInAdvance: config?.billing_in_advance,
            },
            product: {
                name: productItem?.name,
                description: productItem?.description,
            },
            pricing: {
                ...(config?.details?.pricing_type === 'FLAT' && { amount: config.details?.bands?.[0]?.amount }),
                ...(config?.details?.pricing_type === 'TIERED' && { tiered: { bands: config.details?.bands } }),
            },
        };
    });
}
