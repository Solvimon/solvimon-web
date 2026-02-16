import type { PricingItemExtended } from '@solvimon/types';
import { formatAmount, useIntl, useTimePeriod } from '@solvimon/ui';

/**
 * Utility function for rendering the pricing for a pricing item.
 */
export function usePricingItem() {
    const { $t } = useIntl();
    const { formatTimePeriod } = useTimePeriod();

    const renderPricingForPricingItem = (pricingItem: PricingItemExtended) => {
        const productItem = pricingItem.product_items?.[0];
        const config = pricingItem.configs?.[0];

        if (!config) {
            return $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            });
        }

        if (productItem?.model_type === 'PER_SEAT') {
            return $t({
                defaultMessage: 'Per seat',
                id: 'pricing_item_pricing.per_seat',
                description: 'The pricing item pricing for a per seat pricing item',
            });
        }

        if (config.type === 'FLAT' && config.bands?.[0]?.amount) {
            return $t(
                {
                    defaultMessage: '{pricing} per {billing_period}',
                    id: 'pricing_item_pricing',
                    description: 'The pricing item pricing',
                },
                {
                    pricing: formatAmount(config.bands[0].amount),
                    billing_period: formatTimePeriod(
                        config?.billing_period ?? { type: 'MONTH', value: 1 },
                        {
                            short: true,
                            hideValueForExactPeriods: true,
                        },
                    ),
                },
            );
        }

        if (config.type === 'FIXED' && config.bands?.[0]?.fixed_amount) {
            return $t(
                {
                    defaultMessage: '{pricing} per {billing_period}',
                    id: 'pricing_item_pricing',
                    description: 'The pricing item pricing',
                },
                {
                    pricing: formatAmount(config.bands?.[0]?.fixed_amount),
                    billing_period: formatTimePeriod(
                        config?.billing_period ?? { type: 'MONTH', value: 1 },
                        {
                            short: true,
                            hideValueForExactPeriods: true,
                        },
                    ),
                },
            );
        }

        if (config.type === 'TIERED') {
            return $t({
                defaultMessage: 'Tiered pricing',
                id: 'pricing_item_pricing.tiered',
                description: 'The pricing item pricing for a tiered pricing item',
            });
        }

        if (config.type === 'TOP_TIERED') {
            return $t({
                defaultMessage: 'Top tiered pricing',
                id: 'pricing_item_pricing.top_tiered',
                description: 'The pricing item pricing for a top tiered pricing item',
            });
        }

        if (config.type === 'STAIR_STEP') {
            return $t({
                defaultMessage: 'Stair step pricing',
                id: 'pricing_item_pricing.stair_step',
                description: 'The pricing item pricing for a stair step pricing item',
            });
        }

        if (config.type === 'PASS_THROUGH') {
            return $t({
                defaultMessage: 'Pass through pricing',
                id: 'pricing_item_pricing.pass_through',
                description: 'The pricing item pricing for a pass through pricing item',
            });
        }

        if (config.type === 'NONE') {
            return $t({
                defaultMessage: 'Not billed',
                id: 'pricing_item_pricing.none',
                description: 'The pricing item pricing for a not billed pricing item',
            });
        }

        if (config.type === 'FLAT_TOP_UP') {
            return $t({
                defaultMessage: 'Flat top up pricing',
                id: 'pricing_item_pricing.flat_top_up',
                description: 'The pricing item pricing for a flat top up pricing item',
            });
        }

        if (config.type === 'TIERED_TOP_UP') {
            return $t({
                defaultMessage: 'Tiered top up pricing',
                id: 'pricing_item_pricing.tiered_top_up',
                description: 'The pricing item pricing for a tiered top up pricing item',
            });
        }

        return $t({
            defaultMessage: 'Unsupported pricing',
            id: 'pricing_item_pricing.unsupported_pricing_error',
            description: 'Text displayed when the pricing item pricing is unsupported',
        });
    };

    return { renderPricingForPricingItem };
}
