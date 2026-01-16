import type { Amount, BillingPeriod, PricingExtended, PricingItemConfig } from '@solvimon/types';
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
            bands: PricingItemConfig['bands'];
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
                period: config?.billing_period,
                billedInAdvance: config?.billing_in_advance,
            },
            product: {
                name: productItem?.name,
                description: productItem?.description,
            },
            pricing: {
                ...(config?.type === 'FLAT' && { amount: config.bands?.[0]?.amount }),
                ...(config?.type === 'TIERED' && { tiered: { bands: config.bands } }),
            },
        };
    });
}
