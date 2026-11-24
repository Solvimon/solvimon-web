import type {
    Band,
    BillingPeriod,
    Currency,
    Pricing,
    PricingItemConfig,
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

/** A band of a tiered price, or the price under one condition. */
export interface UsagePriceRow {
    label: string;
    rate?: string;
}

export interface UsagePrice {
    name: string;
    billingPeriod?: BillingPeriod;
    rate?: string;
    rows?: UsagePriceRow[];
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

    const formatBlockRate = (
        band: Band,
        blockSize: number,
        units: string | undefined,
    ): string | undefined => {
        if (!band.amount || Number(band.percentage) || band.fixed_amount) return undefined;
        return $t(
            {
                defaultMessage: '{amount} / {blockSize} {unit}',
                id: 'checkout.order_summary_block.usage.rate_per_block',
                description: 'A usage price per block of units, e.g. "$0.02 / 1M tokens"',
            },
            {
                amount: formatAmount(band.amount),
                // Compact notation rounds: 1,234,567 must not read as "1.2M".
                blockSize: formatNumber(
                    blockSize,
                    Number(blockSize.toPrecision(3)) === blockSize
                        ? { notation: 'compact', maximumSignificantDigits: 3 }
                        : undefined,
                ),
                unit:
                    units ??
                    $t({
                        defaultMessage: 'units',
                        id: 'checkout.order_summary_block.usage.units_fallback',
                        description:
                            'The units a usage price is charged per block of when its product names none',
                    }),
            },
        );
    };

    // A rate per unit would misstate a band capped or with a fee on top.
    const formatBand = (
        band: Band,
        unit: string | undefined,
        isStairStep: boolean,
        units?: string,
    ) => {
        if (
            band.minimum_amount ||
            band.maximum_amount ||
            band.minimum_number ||
            band.maximum_number
        ) {
            return undefined;
        }
        if (band.block_size) {
            // A block of an amount (per €1,000 processed, say) has no unit to count.
            const blockSize = 'number' in band.block_size ? Number(band.block_size.number) : 0;
            if (blockSize !== 1) {
                return isStairStep || !(blockSize > 1)
                    ? undefined
                    : formatBlockRate(band, blockSize, units ?? unit);
            }
        }
        if (band.fixed_amount) {
            return isStairStep && !band.amount && !band.percentage
                ? formatAmount(band.fixed_amount)
                : undefined;
        }
        return isStairStep ? undefined : formatRate(band, unit);
    };

    const formatTiers = (
        bands: Band[],
        unit: string | undefined,
        isStairStep: boolean,
        units: string | undefined,
    ) => {
        const i18n = {
            infinite: '',
            formatNumber: (value: number) => formatNumber(value),
            formatAmount,
        };

        return bands.map((band, index): UsagePriceRow => {
            const from = String(getBottomBound(i18n)(bands[index - 1]) ?? '');
            const isLast = index === bands.length - 1;

            return {
                label: isLast
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
                rate: formatBand(band, unit, isStairStep, units),
            };
        });
    };

    // A row per condition, only when each one names a single value and has a single rate;
    // otherwise the price shows its name alone.
    const formatConditions = (
        configs: PricingItemConfig[],
        unit: string | undefined,
        units: string | undefined,
    ): UsagePriceRow[] | undefined => {
        const sorted = [...configs].sort((a, b) => a.order - b.order);
        const unnamed = sorted.filter(({ conditions }) => !conditions?.name);
        const propertyIds = new Set(
            unnamed
                .flatMap(({ conditions }) => conditions?.meter_properties ?? [])
                .map(({ id }) => id),
        );
        const defaults = unnamed.filter(({ conditions }) => !conditions?.meter_properties?.length);
        // A bare value says what it matches only while every row matches the same property.
        if (propertyIds.size > 1 || defaults.length > 1) return undefined;

        const rows: UsagePriceRow[] = [];
        for (const { conditions, details } of sorted) {
            const [condition, ...rest] = conditions?.meter_properties ?? [];
            const band = details.bands?.length === 1 ? details.bands[0] : undefined;
            const label =
                conditions?.name ||
                (!condition
                    ? $t({
                          defaultMessage: 'Other',
                          id: 'checkout.order_summary_block.usage.condition_other',
                          description:
                              'The row of a usage price set per condition that applies when no condition matches, e.g. below "spot €6.39 / GPU-hour"',
                      })
                    : !rest.length && condition.comparator === 'EQUALS'
                      ? condition.value
                      : undefined);
            const rate =
                details.pricing_type === 'FLAT' && band
                    ? formatBand(band, unit, false, units)
                    : undefined;
            if (!label || !rate || conditions?.configs?.length) return undefined;
            rows.push({ label, rate });
        }
        return rows;
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
            const configList = configLists.find((list) => config && list?.includes(config)) ?? [];
            // Conditional prices (one rate per card scheme, say) show a row per condition instead.
            const isConditional = !!config?.conditions?.configs?.length || configList.length > 1;

            const unit = productItem.unit_name?.singular || undefined;
            const units = productItem.unit_name?.plural || undefined;
            const bands = details?.bands ?? [];
            const band = bands[0];
            const price: UsagePrice = {
                name: productItem.name || getNameFromPricing(pricing) || '',
                billingPeriod: details?.billing_period ?? billingPeriod,
            };

            const pricingType = isConditional ? undefined : details?.pricing_type;

            if (isConditional) {
                price.rows = formatConditions(configList, unit, units);
            } else if (pricingType && TIERED_TYPES.includes(pricingType)) {
                price.rows = formatTiers(bands, unit, pricingType === 'STAIR_STEP', units);
            } else if (pricingType === 'FLAT' && band) {
                price.rate = formatBand(band, unit, false, units);
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
