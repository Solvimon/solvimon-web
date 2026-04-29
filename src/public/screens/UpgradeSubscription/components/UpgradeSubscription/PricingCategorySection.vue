<script setup lang="ts">
import { Typography } from '@solvimon/solvimon-ui';
import PricingRow from './PricingRow.vue';
import type { OnDemandPricing, OnDemandPricingCategory } from './UpgradeSubscription.types';

const props = defineProps<{
    category: OnDemandPricingCategory;
    selectedItemIds: string[];
}>();

const emit = defineEmits<{
    (e: 'toggle-item', pricingItemId: string): void;
}>();

const isSelected = (pricing: OnDemandPricing): boolean => {
    const itemId = pricing.items?.[0]?.id;
    return !!itemId && props.selectedItemIds.includes(itemId);
};
</script>

<template>
    <div class="flex flex-col gap-2 border-b border-gray-200 pb-2">
        <Typography variant="body-sm" weight="semibold">{{
            category.product_category?.name ?? category.name
        }}</Typography>

        <div class="flex flex-col overflow-hidden rounded-md border border-gray-200">
            <PricingRow
                v-for="pricing in category.pricings ?? []"
                :key="pricing.id"
                :pricing="pricing"
                :selected="isSelected(pricing)"
                @toggle-item="emit('toggle-item', $event)"
            />

            <template v-for="group in category.pricing_groups ?? []" :key="group.id">
                <Typography variant="body-xs" shade="lighter" weight="semibold" class="px-1 pt-1">{{
                    group.name
                }}</Typography>
                <PricingRow
                    v-for="pricing in group.pricings"
                    :key="pricing.id"
                    :pricing="pricing"
                    :selected="isSelected(pricing)"
                    @toggle-item="emit('toggle-item', $event)"
                />
            </template>
        </div>
    </div>
</template>
