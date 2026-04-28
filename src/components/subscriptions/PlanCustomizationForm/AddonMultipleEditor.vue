<script setup lang="ts">
import type { Pricing } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import { Button, Section, useIntl, usePricingItem } from '@solvimon/ui';
import PricingGroupTitle from './PricingGroupTitle.vue';
import PricingGroupContent from './PricingGroupContent.vue';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';
import { getNameFromPricing } from '@/utils/pricing';

const props = defineProps<
    Omit<PricingGroupEditorBaseProps, 'groupName'> & { groupName?: string }
>();
const model = defineModel<Pricing['id'][]>('modelValue', { required: true });

const { $t } = useIntl();
const { renderPricingForPricingItem } = usePricingItem({
    currency: computed(() => props.currency),
    billingPeriod: computed(() => props.billingPeriod),
});

const isSelected = (pricingId: Pricing['id']) => {
    return model.value.includes(pricingId);
};

const handleToggle = (pricingId: Pricing['id']) => {
    if (isSelected(pricingId)) {
        model.value = model.value.filter((id) => id !== pricingId);
    } else {
        model.value = [...model.value, pricingId];
    }
};
</script>

<template>
    <Section no-spacing :no-border="!groupName" :content-background="groupName ? 'gray' : 'none'">
        <div class="grid grid-cols-1 gap-1" :class="{ 'p-1': groupName }">
            <PricingGroupTitle v-if="groupName">
                <template #title>{{ groupName }}</template>
                <template #description>{{
                    $t({
                        defaultMessage: 'Select any number of products',
                        id: 'addon_multiple_editor.description',
                        description: 'The description of the addon multiple editor',
                    })
                }}</template>
            </PricingGroupTitle>

            <div class="grid grid-cols-1 gap-1">
                <template v-for="pricing in pricings" :key="pricing.id">
                    <Section
                        :content-background="groupName || isSelected(pricing.id) ? 'none' : 'gray'"
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
                                          id: 'addon_multiple_editor.unsupported_pricing_error',
                                          description:
                                              'Text displayed when the pricing item pricing is unsupported',
                                      })
                            "
                        >
                            <template #default>
                                <Button
                                    v-if="isSelected(pricing.id)"
                                    color="gray"
                                    variant="outline"
                                    square
                                    size="sm"
                                    icon-prefix="remove_shopping_cart"
                                    @click="handleToggle(pricing.id)"
                                />
                                <Button
                                    v-else
                                    color="primary"
                                    icon-prefix="add"
                                    size="sm"
                                    @click="handleToggle(pricing.id)"
                                    >{{
                                        $t({
                                            defaultMessage: 'Add to subscription ',
                                            id: 'addon_multiple_editor.add_to_subscription_button',
                                            description:
                                                'The button to add a pricing to the subscription',
                                        })
                                    }}</Button
                                >
                            </template>
                        </PricingGroupContent>
                    </Section>
                </template>
            </div>
        </div>
    </Section>
</template>
