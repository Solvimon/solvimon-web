<script setup lang="ts">
import { Section, Toggle, useIntl, usePricingItem } from '@solvimon/ui';
import { computed } from 'vue';
import type { Pricing } from '@solvimon/solvimon-types';
import type { AddonSingleEditorProps } from './AddonSingleEditor.types';
import PricingGroupTitle from './PricingGroupTitle.vue';
import PricingGroupContent from './PricingGroupContent.vue';
import { getNameFromPricing } from '@/utils/pricing';

const props = defineProps<AddonSingleEditorProps>();
const model = defineModel<Pricing['id'][]>('modelValue', { required: true });

const { $t } = useIntl();
const { renderPricingForPricingItem } = usePricingItem({
    currency: computed(() => props.currency),
    billingPeriod: computed(() => props.billingPeriod),
});

const groupPricingIds = props.pricings.map((pricing) => pricing.id);

const constraintDescription = computed(() => {
    if (props.constraint === 'AT_MOST_ONE') {
        return $t({
            defaultMessage: 'Select up to one product',
            id: 'addon_single_editor.description.at_most_one',
            description: 'The description of the addon single editor for at most one product',
        });
    }

    if (props.constraint === 'EXACTLY_ONE') {
        return $t({
            defaultMessage: 'Select one product',
            id: 'addon_single_editor.description.exactly_one',
            description: 'The description of the addon single editor for exactly one product',
        });
    }

    if (props.constraint === 'AT_LEAST_ONE') {
        return $t({
            defaultMessage: 'Select at least one product',
            id: 'addon_single_editor.description.at_least_one',
            description: 'The description of the addon single editor for at least one product',
        });
    }

    return '';
});

const isSelected = (pricingId: Pricing['id']) => {
    return props.modelValue.includes(pricingId);
};

const handleToggle = (pricingId: Pricing['id']) => {
    if (isSelected(pricingId)) {
        model.value = model.value.filter((id) => id !== pricingId);
    } else {
        const filteredPricingIds = model.value.filter((id) => !groupPricingIds.includes(id));
        model.value = [...filteredPricingIds, pricingId];
    }
};
</script>

<template>
    <Section no-spacing>
        <div class="p-1">
            <PricingGroupTitle>
                <template #title>{{ groupName }}</template>
                <template #description>{{ constraintDescription }}</template>
            </PricingGroupTitle>

            <div class="grid grid-cols-1 gap-1 pt-1">
                <template v-for="pricing in pricings" :key="pricing.id">
                    <Section
                        content-background="none"
                        :class="{ '!bg-white': isSelected(pricing.id) }"
                    >
                        <PricingGroupContent
                            :name="getNameFromPricing(pricing) ?? ''"
                            :description="
                                pricing.items?.[0]
                                    ? renderPricingForPricingItem({
                                          pricingItem: pricing.items?.[0],
                                      })
                                    : $t({
                                          defaultMessage: 'Unsupported pricing',
                                          id: 'pricing_item_pricing.unsupported_pricing_error',
                                          description:
                                              'Text displayed when the pricing item pricing is unsupported',
                                      })
                            "
                        >
                            <template #default>
                                <Toggle
                                    :model-value="isSelected(pricing.id)"
                                    @update:model-value="handleToggle(pricing.id)"
                                />
                            </template>
                        </PricingGroupContent>
                    </Section>
                </template>
            </div>
        </div>
    </Section>
</template>
