<script setup lang="ts">
import { computed } from 'vue';
import {
    RadioGroupExtended,
    Section,
    SelectExtended,
    useIntl,
    type RadioGroupExtendedProps,
    type SelectExtendedOptionEntry,
} from '@solvimon/solvimon-ui';
import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanSelectorProps } from './SubscriptionPlanSelector.types';
import PricingGroupTitle from '@/components/subscriptions/PlanCustomizationForm/PricingGroupTitle.vue';
import { useViewport } from '@/composables/useViewport';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

const SHOW_RADIO_GROUP_MAX_OPTIONS = 3;

const props = defineProps<SubscriptionPlanSelectorProps>();

const pricingPlanId = defineModel<PricingPlan['id'] | undefined>('pricingPlanId');

const { $t } = useIntl();
const { isMobileViewport } = useViewport();

const title = computed(
    () =>
        props.groupName ||
        $t({
            defaultMessage: 'Plan',
            id: 'subscription_management.plan_selector.title',
            description: 'Heading above the plans a subscription can be moved between',
        }),
);

/**
 * What the customer is promised about the move. The group decides the timing, so the option says
 * it outright rather than leaving the customer to find out on the invoice.
 */
const describeOption = ({ isCurrent, changeType, description }: SubscriptionPlanOption) => {
    const timing = () => {
        if (isCurrent) {
            return $t({
                defaultMessage: 'Your current plan',
                id: 'subscription_management.plan_selector.current',
                description: 'Marks the plan a subscription already runs on',
            });
        }

        if (changeType === 'NEXT_BILLING_PERIOD') {
            return $t({
                defaultMessage: 'Starts on your next billing period',
                id: 'subscription_management.plan_selector.next_billing_period',
                description:
                    'Says when a move to this plan takes effect, for plans that change at the next billing period',
            });
        }

        return $t({
            defaultMessage: 'Starts right away',
            id: 'subscription_management.plan_selector.immediate',
            description:
                'Says when a move to this plan takes effect, for plans that change at once',
        });
    };

    return [description, timing()].filter(Boolean).join(' · ');
};

const options = computed(() =>
    props.options.map((option) => ({
        label: option.name,
        value: option.pricingPlanId,
        description: describeOption(option),
    })),
);

/** `RadioGroupExtended` reports `string | boolean`; only its string options are ever selectable. */
const radioModelValue = computed<string | boolean | undefined>({
    get: () => pricingPlanId.value,
    set: (value) => {
        pricingPlanId.value = typeof value === 'string' ? value : undefined;
    },
});

/** `SelectExtended` reports `null` for a cleared selection. */
const selectModelValue = computed<string | null | undefined>({
    get: () => pricingPlanId.value,
    set: (value) => {
        pricingPlanId.value = value ?? undefined;
    },
});

const getRadioGroupOptions = (): RadioGroupExtendedProps['options'] =>
    options.value.map(({ label, value, description }) => ({ label, value, description }));

const getSelectOptions = (): SelectExtendedOptionEntry[] =>
    options.value.map(({ label, value, description: subLabel }) => ({ label, value, subLabel }));
</script>

<template>
    <Section no-spacing class="sv-subscription-plan-selector">
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ title }}</template>
            </PricingGroupTitle>
            <div class="pt-1">
                <RadioGroupExtended
                    v-if="options.length <= SHOW_RADIO_GROUP_MAX_OPTIONS"
                    v-model="radioModelValue"
                    class="sv-subscription-plan-selector__options"
                    :options="getRadioGroupOptions()"
                    :direction="isMobileViewport ? 'column' : 'row'"
                    :disabled="disabled"
                    :show-radio="false"
                />
                <SelectExtended
                    v-else
                    v-model:single-model-value="selectModelValue"
                    class="sv-subscription-plan-selector__options"
                    :options="getSelectOptions()"
                    :disabled="disabled"
                    size="xl"
                    show-sub-label-in-input
                />
            </div>
        </div>
    </Section>
</template>
