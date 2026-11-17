<script setup lang="ts">
import { Expand, Icon, Section, Typography, useIntl, useTimePeriod } from '@solvimon/solvimon-ui';
import { computed, ref, useId } from 'vue';
import type { UsagePriceGroup } from './OrderSummaryUsage.lib';

const props = defineProps<{ groups: UsagePriceGroup[] }>();

const { $t } = useIntl();
const { map } = useTimePeriod();

const isExpanded = ref(false);
const panelId = useId();

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
    <Section
        no-spacing
        class="sv-order-summary__usage"
        :content-background="isExpanded ? 'none' : 'gray'"
        :content-classes="`transition duration-300 ease-in-out${isExpanded ? ' bg-white shadow-[0_0_0_2px_rgb(0_0_0/0.04)]' : ''}`"
    >
        <div v-if="!groups.length" class="px-3 py-2">
            <Typography no-spacing variant="body-sm" color="subtle">{{ usageLabel }}</Typography>
        </div>
        <button
            v-else
            type="button"
            class="flex w-full cursor-pointer flex-row items-center justify-between gap-3 px-3 py-2 text-left"
            :aria-expanded="isExpanded"
            :aria-controls="panelId"
            @click="isExpanded = !isExpanded"
        >
            <span class="flex flex-row flex-wrap items-baseline gap-x-2">
                <Typography no-spacing tag="span" variant="body-sm" weight="semibold">
                    {{ usageLabel }}
                </Typography>
                <Typography v-if="subtitle" no-spacing tag="span" variant="body-xs" color="subtle">
                    {{ subtitle }}
                </Typography>
            </span>
            <Icon
                icon="keyboard_arrow_down"
                class="shrink-0 transition ease-in-out"
                :class="{ 'rotate-180': isExpanded }"
            />
        </button>

        <div v-if="groups.length" :id="panelId" :inert="!isExpanded || undefined">
            <Expand :is-open="isExpanded" lazy>
                <div class="flex flex-col gap-3 border-t px-3 py-2">
                    <div
                        v-for="(group, groupIndex) in groups"
                        :key="groupIndex"
                        class="flex flex-col gap-1.5"
                    >
                        <Typography v-if="group.name" variant="caps-heading">{{
                            group.name
                        }}</Typography>
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
                                <Typography
                                    variant="body-xs"
                                    color="subtle"
                                    tag="div"
                                    class="break-words"
                                >
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
            </Expand>
        </div>
    </Section>
</template>
