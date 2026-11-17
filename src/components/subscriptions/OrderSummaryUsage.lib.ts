import type {
    Band,
    BillingPeriod,
    Currency,
    Pricing,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import {
    formatAmount,
    getBottomBound,
    getConfigFromPricingItem,
    getTopBound,
    type useIntl,
} from '@solvimon/solvimon-ui';
import { getChargedPricings, getNameFromPricing } from '@/utils/pricing';
import { withScheduleOverrides } from '@/utils/pricingPlanScheduleOverrides';

export interface UsagePriceTier {
    range: string;
    rate?: string;
}

export interface UsagePrice {
    name: string;
    billingPeriod?: BillingPeriod;
    rate?: string;
    tiers?: UsagePriceTier[];
}

export interface UsagePriceGroup {
    name: string;
    prices: UsagePrice[];
}

const TIERED_TYPES = ['TIERED', 'TOP_TIERED', 'STAIR_STEP'];

export function getUsagePriceGroups({
    scheduleInfo,
    enabledPricingIds,
    currency,
    billingPeriod,
    intl: { $t, formatNumber },
}: {
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined;
    enabledPricingIds?: Pricing['id'][];
    currency?: Currency['currencyCode'];
    billingPeriod?: BillingPeriod;
    intl: Pick<ReturnType<typeof useIntl>, '$t' | 'formatNumber'>;
}): UsagePriceGroup[] {
    if (!scheduleInfo) return [];

    const formatRate = (band: Band, unit: string | undefined): string | undefined => {
        const percentage =
            Number(band.percentage) !== 0 &&
            band.percentage &&
            formatNumber(Number(band.percentage) / 100, {
                style: 'percent',
                maximumFractionDigits: 4,
            });
        const amount =
            band.amount &&
            !(percentage && Number(band.amount.quantity) === 0) &&
            formatAmount(band.amount);
        const perUnit =
            unit ??
            $t({
                defaultMessage: 'unit',
                id: 'checkout.order_summary_block.usage.unit_fallback',
                description: 'The unit a usage price is charged per when its product names none',
            });

        if (percentage && amount) {
            return $t(
                {
                    defaultMessage: '{percentage} + {amount} / {unit}',
                    id: 'checkout.order_summary_block.usage.rate_percentage_amount',
                    description:
                        'A usage price of a percentage plus an amount per unit, e.g. "1.4% + €0.25 / transaction"',
                },
                { percentage, amount, unit: perUnit },
            );
        }
        if (amount) {
            return $t(
                {
                    defaultMessage: '{amount} / {unit}',
                    id: 'checkout.order_summary_block.usage.rate_per_unit',
                    description: 'A usage price per unit, e.g. "€0.05 / transaction"',
                },
                { amount, unit: perUnit },
            );
        }
        if (percentage && unit) {
            return $t(
                {
                    defaultMessage: '{percentage} of {unit} value',
                    id: 'checkout.order_summary_block.usage.rate_percentage',
                    description:
                        'A usage price as a percentage of what is used, e.g. "1.19% of transaction value"',
                },
                { percentage, unit },
            );
        }
        return percentage || undefined;
    };

    // A rate per unit would misstate a band priced per block, capped, or with a fee on top.
    const formatBand = (band: Band, unit: string | undefined, isStairStep: boolean) => {
        if (
            band.block_size ||
            band.minimum_amount ||
            band.maximum_amount ||
            band.minimum_number ||
            band.maximum_number
        ) {
            return undefined;
        }
        if (band.fixed_amount) {
            return isStairStep && !band.amount && !band.percentage
                ? formatAmount(band.fixed_amount)
                : undefined;
        }
        return isStairStep ? undefined : formatRate(band, unit);
    };

    const formatTiers = (bands: Band[], unit: string | undefined, isStairStep: boolean) => {
        const i18n = {
            infinite: '',
            formatNumber: (value: number) => formatNumber(value),
            formatAmount,
        };

        return bands.map((band, index): UsagePriceTier => {
            const from = String(getBottomBound(i18n)(bands[index - 1]) ?? '');
            const isLast = index === bands.length - 1;

            return {
                range: isLast
                    ? $t(
                          {
                              defaultMessage: '{from}+',
                              id: 'checkout.order_summary_block.usage.tier_open',
                              description:
                                  'The last band of a tiered usage price, which has no upper bound, e.g. "20,000+"',
                          },
                          { from },
                      )
                    : $t(
                          {
                              defaultMessage: '{from} - {to}',
                              id: 'checkout.order_summary_block.usage.tier_range',
                              description:
                                  'The range of a band of a tiered usage price, e.g. "0 - 20,000"',
                          },
                          { from, to: getTopBound(i18n)(band, bands, index) ?? '' },
                      ),
                rate: formatBand(band, unit, isStairStep),
            };
        });
    };

    const groups = new Map<string, UsagePriceGroup>();

    getChargedPricings(withScheduleOverrides(scheduleInfo).pricing_categories, {
        enabledPricingIds,
    }).forEach(({ category, pricing }) => {
        (pricing.items ?? []).forEach((pricingItem) => {
            const productItem = pricingItem.product_items?.[0];
            if (productItem?.model_type !== 'USAGE_BASED') return;

            const config = getConfigFromPricingItem({ pricingItem, currency, billingPeriod });
            const details = config?.details;
            if (details?.pricing_type === 'NONE') return;

            const configLists = [
                pricingItem.configs,
                ...(pricingItem.billing_period_configs ?? []).map((entry) => entry.configs),
                ...(pricingItem.pricing_currency_configs ?? []).flatMap((entry) => [
                    entry.configs,
                    ...(entry.billing_period_configs ?? []).map((period) => period.configs),
                ]),
            ];
            // Conditional prices (one rate per card scheme, say) have no single rate to show.
            const isConditional =
                !!config?.conditions?.configs?.length ||
                (configLists.find((list) => config && list?.includes(config))?.length ?? 0) > 1;

            const unit = productItem.unit_name?.singular || undefined;
            const bands = details?.bands ?? [];
            const band = bands[0];
            const price: UsagePrice = {
                name: productItem.name || getNameFromPricing(pricing) || '',
                billingPeriod: details?.billing_period ?? billingPeriod,
            };

            const pricingType = isConditional ? undefined : details?.pricing_type;

            if (pricingType && TIERED_TYPES.includes(pricingType)) {
                price.tiers = formatTiers(bands, unit, pricingType === 'STAIR_STEP');
            } else if (pricingType === 'FLAT' && band) {
                price.rate = formatBand(band, unit, false);
            }

            const group = groups.get(category.product_category_id) ?? {
                name: category.product_category?.name ?? '',
                prices: [],
            };
            group.prices.push(price);
            groups.set(category.product_category_id, group);
        });
    });

    return [...groups.values()];
}
