<script setup lang="ts">
import { computed } from 'vue';
import PricingCategorySection from './PricingCategorySection.vue';
import type { OnDemandPricingCategory } from './UpgradeSubscription.types';

const props = defineProps<{
    categories: OnDemandPricingCategory[];
    selectedItemIds: string[];
}>();

const emit = defineEmits<{
    (e: 'toggle-item', pricingItemId: string): void;
}>();

const sortedCategories = computed(() =>
    [...props.categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
);
</script>

<template>
    <div class="flex flex-col gap-6">
        <PricingCategorySection
            v-for="category in sortedCategories"
            :key="category.id ?? category.display_order"
            :category="category"
            :selected-item-ids="selectedItemIds"
            @toggle-item="emit('toggle-item', $event)"
        />
    </div>
</template>
