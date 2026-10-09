<script setup lang="ts">
import { computed } from 'vue';
import { Icon, RadioGroupExtended, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanSelectorProps } from './SubscriptionPlanSelector.types';

const props = defineProps<SubscriptionPlanSelectorProps>();

const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();

const options = computed(() =>
    props.options.map(({ pricingPlanId: value, name, description }) => ({
        label: name,
        value,
        ...(description && { description }),
    })),
);

/** The slot hands back the option it rendered, which carries no more than a label and a value. */
const optionsByPlanId = computed(
    () => new Map(props.options.map((option) => [option.pricingPlanId, option])),
);

const isCurrentPlan = (value: string | boolean) =>
    typeof value === 'string' && Boolean(optionsByPlanId.value.get(value)?.isCurrent);

/** `RadioGroupExtended` reports `string | boolean`; only its string options are ever selectable. */
const radioModelValue = computed<string | boolean | undefined>({
    get: () => pricingPlanId.value,
    set: (value) => {
        pricingPlanId.value = typeof value === 'string' ? value : undefined;
    },
});
</script>

<template>
    <div class="sv-subscription-plan-selector flex flex-col gap-2">
        <Typography tag="span" variant="body" weight="semibold" no-spacing>
            {{
                $t({
                    defaultMessage: 'Pick your plan',
                    id: 'subscription_management.plan_selector.title',
                    description: 'Heading above the plans a subscription can be moved between',
                })
            }}
        </Typography>

        <RadioGroupExtended
            v-model="radioModelValue"
            class="sv-subscription-plan-selector__options [&>div[role=group]]:gap-2 [&_label]:p-6"
            :options="options"
            direction="column"
            :disabled="disabled"
            :show-radio="false"
        >
            <template #label="{ option }">
                <Typography tag="span" variant="heading-2" weight="semibold" no-spacing>
                    {{ option.label }}
                </Typography>
            </template>

            <template #description="{ option }">
                <Typography
                    v-if="option.description"
                    tag="span"
                    variant="body-sm"
                    color="secondary"
                    no-spacing
                >
                    {{ option.description }}
                </Typography>
            </template>

            <template #suffix="{ optionValue }">
                <div
                    v-if="isCurrentPlan(optionValue)"
                    class="sv-subscription-plan-selector__current flex shrink-0 items-center gap-1 rounded border border-gray-200 bg-white px-3 py-2 text-primary-600"
                >
                    <Icon icon="check" size="xs" />
                    <Typography
                        tag="span"
                        variant="body-xs"
                        weight="semibold"
                        color="inherit"
                        no-spacing
                    >
                        {{
                            $t({
                                defaultMessage: 'Current subscription',
                                id: 'subscription_management.plan_selector.current',
                                description: 'Marks the plan a subscription already runs on',
                            })
                        }}
                    </Typography>
                </div>
            </template>
        </RadioGroupExtended>
    </div>
</template>
