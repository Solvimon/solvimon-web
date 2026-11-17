<script setup lang="ts">
import { Typography, useIntl, useTimePeriod } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import OrderSummaryCollapsible from './OrderSummaryCollapsible.vue';
import type { UsagePriceGroup } from './OrderSummaryUsage.lib';

const props = defineProps<{ groups: UsagePriceGroup[] }>();

const { $t } = useIntl();
const { map } = useTimePeriod();

const usageLabel = computed(() =>
    $t({
        defaultMessage: '+ Usage',
        id: 'checkout.invoice_preview.usage_based_message',
        description: 'The message shown for the usage based invoice preview',
    }),
);

const subtitle = computed(() => {
    const periods = props.groups.flatMap((group) =>
        group.prices.map((price) => price.billingPeriod),
    );
    const [first] = periods;
    const isSharedSinglePeriod =
        !!first &&
        (first.value ?? 1) === 1 &&
        periods.every((period) => period?.type === first.type && (period.value ?? 1) === 1);

    return isSharedSinglePeriod
        ? $t(
              {
                  defaultMessage: 'Billed {period}',
                  id: 'checkout.order_summary_block.usage.billed_period',
                  description:
                      'Next to the usage line of the order summary, how often usage is billed, e.g. "Billed monthly"',
              },
              { period: map.value[first.type].full },
          )
        : undefined;
});
</script>

<template>
    <OrderSummaryCollapsible
        class="sv-order-summary__usage"
        :title="usageLabel"
        :subtitle="subtitle"
        :expandable="groups.length > 0"
    >
        <div class="flex flex-col gap-3">
            <div
                v-for="(group, groupIndex) in groups"
                :key="groupIndex"
                class="flex flex-col gap-1.5"
            >
                <Typography v-if="group.name" variant="caps-heading">{{ group.name }}</Typography>
                <template v-for="(price, index) in group.prices" :key="index">
                    <div class="sv-order-summary__usage-price grid grid-cols-2 gap-2">
                        <Typography
                            variant="body-xs"
                            weight="semibold"
                            tag="div"
                            class="break-words"
                        >
                            {{ price.name }}
                        </Typography>
                        <Typography
                            variant="body-xs"
                            color="subtle"
                            tag="div"
                            class="break-words text-right"
                        >
                            {{ price.rate }}
                        </Typography>
                    </div>
                    <div
                        v-for="(tier, tierIndex) in price.tiers"
                        :key="`${index}-${tierIndex}`"
                        class="sv-order-summary__usage-price grid grid-cols-2 gap-2"
                    >
                        <Typography variant="body-xs" color="subtle" tag="div" class="break-words">
                            {{ tier.range }}
                        </Typography>
                        <Typography
                            variant="body-xs"
                            color="subtle"
                            tag="div"
                            class="break-words text-right"
                        >
                            {{ tier.rate }}
                        </Typography>
                    </div>
                </template>
            </div>
        </div>
    </OrderSummaryCollapsible>
</template>
