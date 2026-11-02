<script setup lang="ts">
import { computed } from 'vue';
import { Avatar, Chip, RadioGroupExtended, Typography, useIntl } from '@solvimon/solvimon-ui';
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
            class="sv-subscription-plan-selector__options [&>div[role=group]]:gap-2"
            :options="options"
            direction="column"
            :disabled="disabled"
            :show-radio="false"
        >
            <template v-if="avatar" #prefix>
                <Avatar :image-src="avatar" size="md" class="shrink-0 self-center" />
            </template>

            <template #label="{ option, optionValue }">
                <span class="flex flex-wrap items-center gap-2">
                    <Typography tag="span" variant="body" weight="semibold" no-spacing>
                        {{ option.label }}
                    </Typography>
                    <Chip
                        v-if="isCurrentPlan(optionValue)"
                        class="sv-subscription-plan-selector__current"
                        intent="brand"
                        size="xs"
                        :content="
                            $t({
                                defaultMessage: 'Current plan',
                                id: 'subscription_management.plan_selector.current_plan',
                                description: 'Marks the plan a subscription already runs on',
                            })
                        "
                    />
                </span>
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
        </RadioGroupExtended>
    </div>
</template>
