<script setup lang="ts">
import { formatAmount, Typography, useIntl, useTimePeriod } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PricingItemPricingProps } from './PricingItemPricing.types';

const props = withDefaults(defineProps<PricingItemPricingProps>(), {
    variant: 'body-sm',
    shade: 'lighter',
});

const { pricingItem, ...typographyProps } = props;

const { formatTimePeriod } = useTimePeriod();
const { $t } = useIntl();

const amount = computed(() => pricingItem.configs?.[0]?.details?.bands?.[0]?.amount);
const billingPeriod = computed(() => pricingItem.configs?.[0]?.billing_period);
</script>

<template>
    <Typography v-bind="typographyProps">
        <template v-if="!amount">{{
            $t({
                defaultMessage: 'Unsupported pricing',
                id: 'pricing_item_pricing.unsupported_pricing_error',
                description: 'Text displayed when the pricing item pricing is unsupported',
            })
        }}</template>
        <template v-else>
            {{
                $t(
                    {
                        defaultMessage: '{pricing} per {billing_period}',
                        id: 'pricing_item_pricing',
                        description: 'The pricing item pricing',
                    },
                    {
                        pricing: formatAmount(amount),
                        billing_period:
                            formatTimePeriod(billingPeriod ?? { type: 'MONTH', value: 1 }, {
                                short: true,
                                hideValueForExactPeriods: true,
                            }) ?? '',
                    },
                )
            }}
        </template>
    </Typography>
</template>
