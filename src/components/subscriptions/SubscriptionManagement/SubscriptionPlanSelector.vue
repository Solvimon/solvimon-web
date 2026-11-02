<script setup lang="ts">
import { computed } from 'vue';
import { Avatar, Chip, RadioGroupExtended, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanSelectorProps } from './SubscriptionPlanSelector.types';

const props = defineProps<SubscriptionPlanSelectorProps>();

const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();

const currentPlanLabel = computed(() =>
    $t({
        defaultMessage: 'Current plan',
        id: 'subscription_management.plan_selector.current_plan',
        description: 'Marks the plan a subscription already runs on',
    }),
);

/**
 * The group reads each option out by its label, which overrides what the option renders, so the
 * current plan says so in its label too; on screen the chip says it.
 */
const options = computed(() =>
    props.options.map(({ pricingPlanId: value, name, description, isCurrent }) => ({
        label: isCurrent ? `${name} (${currentPlanLabel.value})` : name,
        value,
        ...(description && { description }),
    })),
);

const optionsByPlanId = computed(
    () => new Map(props.options.map((option) => [option.pricingPlanId, option])),
);

const getOption = (value: string | boolean) =>
    typeof value === 'string' ? optionsByPlanId.value.get(value) : undefined;

/** `RadioGroupExtended` reports `string | boolean`; only its string options are ever selectable. */
const radioModelValue = computed<string | boolean | undefined>({
    get: () => pricingPlanId.value,
    set: (value) => {
        pricingPlanId.value = typeof value === 'string' ? value : undefined;
    },
});
</script>

<template>
    <div class="sv-subscription-plan-selector">
        <RadioGroupExtended
            v-model="radioModelValue"
            :label="
                $t({
                    defaultMessage: 'Pick your plan',
                    id: 'subscription_management.plan_selector.title',
                    description: 'Heading above the plans a subscription can be moved between',
                })
            "
            :options="options"
            direction="column"
            :disabled="disabled"
            :show-radio="false"
        >
            <template v-if="avatar" #prefix>
                <Avatar :image-src="avatar" size="md" class="shrink-0 self-center" />
            </template>

            <template #label="{ optionValue }">
                <span class="flex flex-wrap items-center gap-2">
                    <Typography tag="span" variant="body" weight="semibold" no-spacing>
                        {{ getOption(optionValue)?.name }}
                    </Typography>
                    <Chip
                        v-if="getOption(optionValue)?.isCurrent"
                        class="sv-subscription-plan-selector__current"
                        intent="brand"
                        size="xs"
                        :content="currentPlanLabel"
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
