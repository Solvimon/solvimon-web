<script setup lang="ts">
import { computed } from 'vue';
import { Typography } from '@solvimon/solvimon-ui';
import OnDemandPricingRow from './OnDemandPricingRow.vue';
import type { OnDemandPricingCategory } from './UpgradeSubscription/UpgradeSubscription.types';

const props = defineProps<{
    categories: OnDemandPricingCategory[];
    selectedPricingIds: string[];
}>();

const emit = defineEmits<{
    (e: 'toggle', pricingId: string): void;
}>();

const sortedCategories = computed(() =>
    [...props.categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
);
</script>

<template>
    <template v-for="category in sortedCategories" :key="category.id ?? category.display_order">
        <div class="flex flex-col gap-2">
            <Typography variant="heading-3" tag="h2">{{
                category.product_category?.name ?? category.name
            }}</Typography>

            <div class="grid grid-cols-1 gap-1">
                <OnDemandPricingRow
                    v-for="pricing in category.pricings"
                    :key="pricing.id"
                    :pricing="pricing"
                    :selected="selectedPricingIds.includes(pricing.id)"
                    @toggle="emit('toggle', $event)"
                />

                <template v-for="group in category.pricing_groups" :key="group.id">
                    <Typography variant="body-sm" weight="semibold" class="mt-2">{{
                        group.name
                    }}</Typography>
                    <OnDemandPricingRow
                        v-for="pricing in group.pricings"
                        :key="pricing.id"
                        :pricing="pricing"
                        :selected="selectedPricingIds.includes(pricing.id)"
                        @toggle="emit('toggle', $event)"
                    />
                </template>
            </div>
        </div>
    </template>
</template>
