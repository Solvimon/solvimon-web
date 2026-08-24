import type { BillingPeriod, Currency, PricingExtended } from '@solvimon/solvimon-types';
import { useIntl, usePricingItem } from '@solvimon/solvimon-ui';
import type { Ref } from 'vue';

/**
 * How a pricing reads in the plan editors: its first item rendered for the currency and billing
 * period on offer, or a stand-in when there is no item to render.
 */
export function usePricingDescription({
    currency,
    billingPeriod,
}: {
    currency: Ref<Currency['currencyCode'] | undefined>;
    billingPeriod: Ref<BillingPeriod>;
}) {
    const { $t } = useIntl();
    const { renderPricingForPricingItem } = usePricingItem({ currency, billingPeriod });

    const describePricing = (pricing: PricingExtended): string => {
        const pricingItem = pricing.items?.[0];

        return pricingItem
            ? renderPricingForPricingItem({ pricingItem })
            : $t({
                  defaultMessage: 'Unsupported pricing',
                  id: 'pricing_item_pricing.unsupported_pricing_error',
                  description: 'Text displayed when the pricing item pricing is unsupported',
              });
    };

    return { describePricing, renderPricingForPricingItem };
}
