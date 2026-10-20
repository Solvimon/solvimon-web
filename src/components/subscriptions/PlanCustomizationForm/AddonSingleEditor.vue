<script setup lang="ts">
import { Section, Toggle, useIntl } from '@solvimon/solvimon-ui';
import { toRef } from 'vue';
import type { Pricing } from '@solvimon/solvimon-types';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';
import PricingGroupTitle from './PricingGroupTitle.vue';
import { usePricingDescription } from './usePricingDescription';
import PricingGroupContent from './PricingGroupContent.vue';
import { getNameFromPricing } from '@/utils/pricing';

const props = defineProps<PricingGroupEditorBaseProps>();
const model = defineModel<Pricing['id'][]>('modelValue', { required: true });

const { $t } = useIntl();
const { describePricing } = usePricingDescription({
    currency: toRef(props, 'currency'),
    billingPeriod: toRef(props, 'billingPeriod'),
});

const groupPricingIds = props.pricings.map((pricing) => pricing.id);

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
                <template #description>{{
                    $t({
                        defaultMessage: 'Select up to one product',
                        id: 'addon_single_editor.description.at_most_one',
                        description:
                            'The description of the addon single editor for at most one product',
                    })
                }}</template>
            </PricingGroupTitle>

            <div class="grid grid-cols-1 gap-1 pt-1">
                <template v-for="pricing in pricings" :key="pricing.id">
                    <Section
                        content-background="none"
                        :class="{ '!bg-white': isSelected(pricing.id) }"
                    >
                        <PricingGroupContent
                            :name="getNameFromPricing(pricing) ?? ''"
                            :description="describePricing(pricing)"
                        >
                            <template #default>
                                <Toggle
                                    :model-value="isSelected(pricing.id)"
                                    size="sm"
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
