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
import { getMeterKind } from '@/utils/addonQuantity';

/**
 * How a pricing reads in the plan editors: each of its items rendered for the currency and billing
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

    // The library reads a one-off flat amount as recurring.
    const describeItem = (pricingItem: PricingItemExtended): string => {
        const config = getConfigFromPricingItem({
            pricingItem,
            currency: currency.value,
            billingPeriod: billingPeriod.value,
        });
        const amount = config?.details?.bands?.[0]?.amount;

        return getMeterKind(pricingItem, config) === 'units' && amount
            ? $t(
                  {
                      defaultMessage: '{amount} per unit, one-time',
                      id: 'units.price_per_unit_one_time',
                      description:
                          'The price per unit label for a one-off flat item, which is charged once rather than every period',
                  },
                  { amount: formatAmount(amount) },
              )
            : renderPricingForPricingItem({ pricingItem });
    };

    const describePricing = (pricing: PricingExtended): string => {
        const items = pricing.items ?? [];

        if (!items.length) {
            return $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            });
        }
        if (items.length === 1) return describeItem(items[0]!);

        return items
            .map((item) => {
                const name = item.product_items?.[0]?.name;
                return name
                    ? $t(
                          {
                              defaultMessage: '{name}: {pricing}',
                              id: 'pricing_description.named_item',
                              description:
                                  'One item of a pricing with several items, as its name and its price',
                          },
                          { name, pricing: describeItem(item) },
                      )
                    : describeItem(item);
            })
            .reduce((list, item) =>
                $t(
                    {
                        defaultMessage: '{list} · {item}',
                        id: 'pricing_description.item_list',
                        description:
                            'Joins the items of a pricing with several items into one line',
                    },
                    { list, item },
                ),
            );
    };

    return { describePricing };
}
