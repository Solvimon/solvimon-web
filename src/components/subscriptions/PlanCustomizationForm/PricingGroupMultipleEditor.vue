<script setup lang="ts">
import type { PricingGroupMultiEditorProps } from './PricingGroupMultipleEditor.types';
import { getNameFromPricing } from '@/utils/pricing';
import { Section, useIntl, useValidation } from '@solvimon/ui';
import PricingGroupTitle from './PricingGroupTitle.vue';
import { CheckboxGroupExtended } from '@solvimon/ui';
import { usePricingItem } from '@/composables/usePricingItem';
import { computed } from 'vue';
import { containsAtLeastOneOf } from '@solvimon/ui/validators';
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

const props = defineProps<PricingGroupMultiEditorProps>();

const model = defineModel<PricingGroupMultiEditorProps['modelValue']>('modelValue', {
    required: true,
});

const { $t } = useIntl();
const { renderPricingForPricingItem } = usePricingItem();

const rules = computed(() => ({
    value: {
        containsAtLeastOneOf: containsAtLeastOneOf(props.pricings.map((pricing) => pricing.id)),
    },
}));

const validationState = computed(() => ({ value: model.value }));
const validation = useValidation(rules, validationState);

const breakpoints = useBreakpoints(breakpointsTailwind);
const isMobileViewport = breakpoints.smallerOrEqual('sm');
</script>

<template>
    <Section no-spacing>
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ groupName }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Select at least one product',
                        id: '123456',
                        description: 'Add to subscription button',
                    })
                }}</template>
            </PricingGroupTitle>
            <div class="pt-1">
                <CheckboxGroupExtended
                    v-model="model"
                    :options="
                        pricings.map((pricing) => ({
                            label: getNameFromPricing(pricing) ?? '',
                            description: pricing.items?.[0]
                                ? renderPricingForPricingItem(pricing.items?.[0])
                                : $t({
                                      defaultMessage: 'Unsupported pricing',
                                      id: 'pricing_item_pricing.unsupported_pricing_error',
                                      description:
                                          'Text displayed when the pricing item pricing is unsupported',
                                  }),
                            value: pricing.id,
                        }))
                    "
                    show-checkbox-right
                    :direction="isMobileViewport ? 'column' : 'row'"
                    :error="validation.value.$errors"
                    @blur="validation.value.$touch()"
                />
            </div>
        </div>
    </Section>
</template>
