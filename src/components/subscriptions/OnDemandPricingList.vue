<script setup lang="ts">
import { computed } from 'vue';
import { Typography, useIntl } from '@solvimon/solvimon-ui';
import OnDemandPricingRow from './OnDemandPricingRow.vue';
import type { OnDemandPricingCategory } from './UpgradeSubscription/UpgradeSubscription.types';

const props = defineProps<{
    categories: OnDemandPricingCategory[];
    selectedPricingIds: string[];
    loadingPricingId?: string;
}>();

const emit = defineEmits<{
    (e: 'toggle', pricingId: string): void;
}>();

const { $t } = useIntl();

const sortedCategories = computed(() =>
    [...props.categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
);

const getCategoryTitle = (category: OnDemandPricingCategory) =>
    category.product_category?.name ??
    category.name ??
    $t({
        defaultMessage: 'Items',
        id: 'on_demand_pricing_list.category_fallback_title',
        description:
            'Fallback title for the selectable pricing items when no product category name is available',
    });
</script>

<template>
    <template v-for="category in sortedCategories" :key="category.id ?? category.display_order">
        <div class="sv-pricing-list__category flex flex-col gap-2">
            <Typography variant="heading-3" tag="h2" class="sv-pricing-list__category-title">{{
                getCategoryTitle(category)
            }}</Typography>

            <div class="sv-pricing-list__items grid grid-cols-1 gap-1">
                <OnDemandPricingRow
                    v-for="pricing in category.pricings"
                    :key="pricing.id"
                    class="sv-pricing-list__row"
                    :pricing="pricing"
                    :selected="selectedPricingIds.includes(pricing.id)"
                    :loading="loadingPricingId === pricing.id"
                    @toggle="emit('toggle', $event)"
                />

                <template v-for="group in category.pricing_groups" :key="group.id">
                    <Typography
                        variant="body-sm"
                        weight="semibold"
                        class="sv-pricing-list__group-title mt-2"
                    >{{
                        group.name
                    }}</Typography>
                    <OnDemandPricingRow
                        v-for="pricing in group.pricings"
                        :key="pricing.id"
                        class="sv-pricing-list__row"
                        :pricing="pricing"
                        :selected="selectedPricingIds.includes(pricing.id)"
                        :loading="loadingPricingId === pricing.id"
                        @toggle="emit('toggle', $event)"
                    />
                </template>
            </div>
        </div>
    </template>
</template>
