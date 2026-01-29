<script setup lang="ts">
import { computed } from 'vue';
import type { PricingGroupSingleEditorProps } from './PricingGroupSingleEditor.types';
import {
    RadioGroupExtended,
    Section,
    SelectExtended,
    useIntl,
    type RadioGroupExtendedProps,
    type SelectExtendedOptionEntry,
} from '@solvimon/ui';
import { usePricingItem } from '@/composables/usePricingItem';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';
import { getNameFromPricing } from '@/utils/pricing';
import PricingGroupTitle from './PricingGroupTitle.vue';
import { useViewport } from '@/composables/useViewport';

const SHOW_RADIO_GROUP_MAX_OPTIONS = 3;

const props = defineProps<PricingGroupSingleEditorProps>();
const model = defineModel<PricingGroupSingleEditorProps['modelValue']>('modelValue', {
    required: true,
});

const { $t } = useIntl();
const { renderPricingForPricingItem } = usePricingItem();
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

type PricingGroupOption = {
    label: string;
    value: string;
    description: string;
};

const options = computed<PricingGroupOption[]>(() => {
    return props.pricings.map((pricing) => {
        const pricingItem = pricing.items?.[0];

        return {
            label: getNameFromPricing(pricing) ?? '',
            value: pricing.id,
            description: pricingItem
                ? renderPricingForPricingItem(pricingItem)
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
                <template #description>{{
                    $t({
                        defaultMessage: 'Select one product',
                        id: '123456',
                        description: 'Add to subscription button',
                    })
                }}</template>
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
                    v-else
                    v-model:single-model-value="singleModelValue"
                    :options="getSelectOptions()"
                    size="xl"
                    show-sub-label-in-input
                />
            </div>
        </div>
    </Section>
</template>
