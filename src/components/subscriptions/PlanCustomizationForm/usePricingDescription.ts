import type {
    BillingPeriod,
    Currency,
    PricingExtended,
    PricingItemExtended,
} from '@solvimon/solvimon-types';
import {
    formatAmount,
    getConfigFromPricingItem,
    useIntl,
    usePricingItem,
} from '@solvimon/solvimon-ui';
import type { Ref } from 'vue';
import { getNameFromPricing } from '@/utils/pricing';

/**
 * How a pricing reads in the plan editors: each item rendered for the currency and billing period
 * on offer, named when there is more than one, or a stand-in when there is no item to render.
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

    // The ui renderer reads a flat amount as a price per period, but on a usage-based item it is
    // the price per unit used.
    const describeUsagePricingItem = (pricingItem: PricingItemExtended): string | undefined => {
        const productItem = pricingItem.product_items?.[0];
        if (productItem?.model_type !== 'USAGE_BASED') return undefined;

        const config = getConfigFromPricingItem({
            pricingItem,
            currency: currency.value,
            billingPeriod: billingPeriod.value,
        });
        const amount =
            config?.details?.pricing_type === 'FLAT' && config.details.bands?.[0]?.amount;
        if (!amount) return undefined;

        const unitName = productItem.unit_name?.singular;
        return unitName
            ? $t(
                  {
                      defaultMessage: '{amount} per {unit_name}',
                      id: 'pricing_description.usage_per_named_unit',
                      description:
                          'The price of a usage-based item per unit used, e.g. "$50.44 per hour"',
                  },
                  { amount: formatAmount(amount), unit_name: unitName },
              )
            : $t(
                  {
                      defaultMessage: '{amount} per unit',
                      id: 'pricing_description.usage_per_unit',
                      description:
                          'The price of a usage-based item per unit used, for an item with no unit name',
                  },
                  { amount: formatAmount(amount) },
              );
    };

    const describePricingItem = (pricingItem: PricingItemExtended): string =>
        describeUsagePricingItem(pricingItem) ?? renderPricingForPricingItem({ pricingItem });

    const describePricing = (pricing: PricingExtended): string => {
        const items = pricing.items ?? [];

        if (!items.length) {
            return $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            });
        }

        if (items.length === 1) return describePricingItem(items[0]);

        // The pricing's name is already shown above its description.
        const pricingName = getNameFromPricing(pricing);
        const itemName = (pricingItem: PricingItemExtended) => {
            const name = pricingItem.product_items?.[0]?.name;
            return pricingName && name?.startsWith(`${pricingName} `)
                ? name.slice(pricingName.length + 1)
                : name;
        };

        return items
            .map((pricingItem) => {
                const name = itemName(pricingItem);
                const description = describePricingItem(pricingItem);
                return name
                    ? $t(
                          {
                              defaultMessage: '{name}: {description}',
                              id: 'pricing_description.named_item',
                              description:
                                  'One item of a pricing with several, e.g. "GPU hours: $10.00 per unit"',
                          },
                          { name, description },
                      )
                    : description;
            })
            .join(' · ');
    };

    return { describePricing };
}
