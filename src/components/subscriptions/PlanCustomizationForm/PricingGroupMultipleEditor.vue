<script setup lang="ts">
import { Section, useIntl, usePricingItem, useValidation } from '@solvimon/solvimon-ui';
import { CheckboxGroupExtended } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import { containsAtLeastOneOf } from '@solvimon/solvimon-ui/validators';
import PricingGroupTitle from './PricingGroupTitle.vue';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';
import { getNameFromPricing } from '@/utils/pricing';
import { useViewport } from '@/composables/useViewport';

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

const rules = computed(() => ({
    value: {
        containsAtLeastOneOf: containsAtLeastOneOf(props.pricings.map((pricing) => pricing.id)),
    },
}));

const validationState = computed(() => ({ value: model.value }));
const validation = useValidation(rules, validationState);
</script>

<template>
    <Section no-spacing>
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ groupName }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Select at least one product',
                        id: 'pricing_group_multiple_editor.at_least_one_description',
                        description:
                            'The description of the pricing group multiple editor for at least one product',
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
                                ? renderPricingForPricingItem({
                                      pricingItem: pricing.items?.[0],
                                  })
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
