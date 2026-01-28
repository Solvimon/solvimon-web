import type { Amount, PricingItemExtended } from '@solvimon/types';
import { formatAmount, useIntl, useTimePeriod } from '@solvimon/ui';

/**
 * Utility function for rendering the pricing for a pricing item.
 */
export function usePricingItem() {
    const { $t } = useIntl();
    const { formatTimePeriod } = useTimePeriod();

    const renderPricingForPricingItem = (pricingItem: PricingItemExtended) => {
        const config = pricingItem.configs?.[0];
        let amount: Amount | undefined;

        if (!config) {
            return $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            });
        }

        if (config.type === 'FIXED') {
            amount = config.bands?.[0]?.fixed_amount;
        }

        if (!amount) {
            return $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            });
        }

        return $t(
            {
                defaultMessage: '{pricing} per {billing_period}',
                id: 'pricing_item_pricing',
                description: 'The pricing item pricing',
            },
            {
                pricing: formatAmount(amount),
                billing_period: formatTimePeriod(
                    config?.billing_period ?? { type: 'MONTH', value: 1 },
                    {
                        short: true,
                        hideValueForExactPeriods: true,
                    },
                ),
            },
        );
    };

    return { renderPricingForPricingItem };
}
