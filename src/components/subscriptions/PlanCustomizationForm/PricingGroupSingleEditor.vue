<script setup lang="ts">
import { computed } from 'vue';
import {
    PricingGroupRangeInput,
    RadioGroupExtended,
    Section,
    SelectExtended,
    useIntl,
    type PricingGroupRangeInputOption,
    type RadioGroupExtendedProps,
    type SelectExtendedOptionEntry,
} from '@solvimon/ui';
import PricingGroupTitle from './PricingGroupTitle.vue';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';
import { usePricingItem } from '@/composables/usePricingItem';
import { getNameFromPricing } from '@/utils/pricing';
import { useViewport } from '@/composables/useViewport';

const SHOW_RADIO_GROUP_MAX_OPTIONS = 3;
const SHOW_SELECT_MAX_OPTIONS = 6;

const props = defineProps<PricingGroupEditorBaseProps>();
const model = defineModel<PricingGroupEditorBaseProps['modelValue']>('modelValue', {
    required: true,
});

const { $t } = useIntl();
const { renderPricingForPricingItem } = usePricingItem({
    currency: computed(() => props.currency),
    billingPeriod: computed(() => props.billingPeriod),
});
const { isMobileViewport } = useViewport();

const groupPricingIds = computed(() => props.pricings.map((pricing) => pricing.id));

const singleModelValue = computed<string | undefined>({
    get: () => {
        return model.value.find((id) => groupPricingIds.value.includes(id)) ?? undefined;
    },
    set: (value) => {
        const filteredPricingIds = model.value.filter((id) => !groupPricingIds.value.includes(id));
        model.value = value ? [...filteredPricingIds, value] : filteredPricingIds;
    },
});

const options = computed<PricingGroupRangeInputOption[]>(() => {
    return props.pricings.map((pricing) => {
        const pricingItem = pricing.items?.[0];

        return {
            label: getNameFromPricing(pricing) ?? '',
            value: pricing.id,
            description: pricingItem
                ? renderPricingForPricingItem({ pricingItem })
                : $t({
                      defaultMessage: 'Unsupported pricing',
                      id: 'pricing_item_pricing.unsupported_pricing_error',
                      description: 'Text displayed when the pricing item pricing is unsupported',
                  }),
        };
    });
});

const getRadioGroupOptions = (): RadioGroupExtendedProps['options'] => {
    return options.value.slice(0, SHOW_RADIO_GROUP_MAX_OPTIONS);
};

const getSelectOptions = (): SelectExtendedOptionEntry[] => {
    return options.value.map(({ value, label, description: subLabel }) => ({
        label,
        subLabel,
        value,
    }));
};
</script>

<template>
    <Section no-spacing>
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ groupName }}</template>
            </PricingGroupTitle>
            <div class="pt-1">
                <RadioGroupExtended
                    v-if="options.length <= SHOW_RADIO_GROUP_MAX_OPTIONS"
                    v-model="singleModelValue"
                    :options="getRadioGroupOptions()"
                    :direction="isMobileViewport ? 'column' : 'row'"
                    :show-radio="false"
                />
                <SelectExtended
                    v-else-if="options.length <= SHOW_SELECT_MAX_OPTIONS"
                    v-model:single-model-value="singleModelValue"
                    :options="getSelectOptions()"
                    size="xl"
                    show-sub-label-in-input
                />
                <PricingGroupRangeInput
                    v-else
                    v-model="singleModelValue"
                    :options="options"
                    :name="`pricing-group-range-input-${groupName}`"
                />
            </div>
        </div>
    </Section>
</template>
