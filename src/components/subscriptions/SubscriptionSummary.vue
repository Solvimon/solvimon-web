<script setup lang="ts">
import { Amount, Chip, Typography, useIntl } from '@solvimon/ui';
import { computed } from 'vue';
import type { SubscriptionSummaryProps } from './SubscriptionSummary.types';
import Placeholder from '@/components/shared/Placeholder.vue';

const props = defineProps<SubscriptionSummaryProps>();

const { $t } = useIntl();

const mostRecentPricingPlan = computed(
    () => props.subscription.pricing_plan_schedule_infos?.at(-1)?.pricing_plan_version.pricing_plan
);

const name = computed(
    () =>
        props.subscription.name ||
        mostRecentPricingPlan.value?.name ||
        $t({
            defaultMessage: 'Subscription',
            description: 'The fallback name for when no subscription name can be determined',
            id: 'customer_overview.subscriptions_block.fallback_subscription_name',
        })
);

const formattedPeriod = computed(() =>
    $t(
        {
            defaultMessage:
                '{value, plural, one {{period, select, DAY {Day} WEEK {Week} MONTH {Month} YEAR {Year} other {{value} {period}}}} other {{period, select, DAY {{value} Days} WEEK {{value} Weeks} MONTH {{value} Months} YEAR {{value} Years} other {{value} {period}s}}}}',
            id: 'sdfasdfasdfasdf',
            description: 'tesasdfsadfasdfsadft',
        },
        {
            value: props.subscription.billing_period.value?.toString() || '1',
            period: props.subscription.billing_period.type,
        }
    )
);

const description = computed(
    () => props.subscription.description || mostRecentPricingPlan.value?.description
);

const hasUsageBasedComponent = computed(() =>
    props.invoice
        ? props.invoice.periods.some((period) =>
              period.groups.some((group) =>
                  group.lines?.some((line) =>
                      line.product_items.some(
                          (productItem) => productItem.model_type === 'USAGE_BASED'
                      )
                  )
              )
          )
        : false
);
</script>

<template>
    <div class="flex flex-col md:flex-row gap-4">
        <div class="grow">
            <Typography variant="heading-2">{{ name }}</Typography>
            <Typography v-if="description" variant="body-sm" shade="lighter" no-spacing>{{
                description
            }}</Typography>
        </div>
        <Placeholder
            class="min-w-32 min-h-7 md:self-center"
            :content-ready="!!invoice?.tax_summary.total_amount && !loading"
            :loading="loading"
        >
            <div class="flex items-center gap-2">
                <span>
                    <Typography tag="span" variant="body" weight="semibold">
                        <Amount
                            v-if="invoice?.tax_summary.total_amount"
                            :value="invoice.tax_summary.total_amount"
                        />
                    </Typography>
                    <Typography tag="span" variant="body-xs"
                        >{{ ' / ' }}{{ formattedPeriod }}</Typography
                    >
                </span>
                <Chip v-if="hasUsageBasedComponent" color="dark">{{
                    $t({
                        defaultMessage: '+ usage',
                        id: 'checkout.subscription.usage_chip.label',
                        description:
                            'The label for the chip that indicates a usage based component in the subscription',
                    })
                }}</Chip>
            </div>
        </Placeholder>
    </div>
</template>
