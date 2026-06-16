<script setup lang="ts">
import { computed } from 'vue';
import { Section, Button, formatAmount, useIntl } from '@solvimon/solvimon-ui';
import type { OnDemandPricing } from './UpgradeSubscription/UpgradeSubscription.types';
import PricingGroupContent from '@/components/subscriptions/PlanCustomizationForm/PricingGroupContent.vue';

const props = defineProps<{
    pricing: OnDemandPricing;
    selected: boolean;
    loading?: boolean;
}>();

const emit = defineEmits<{
    (e: 'toggle', pricingId: string): void;
}>();

const { $t } = useIntl();

const title = computed(
    () =>
        props.pricing.name ??
        props.pricing.items?.[0]?.product_items?.[0]?.name ??
        props.pricing.products?.[0]?.name ??
        '—',
);
const price = computed(() => {
    const band = props.pricing.items?.[0]?.configs?.[0]?.bands?.[0];
    // Backend uses fixed_amount for FIXED pricing and amount for FLAT pricing.
    return band?.fixed_amount ?? band?.amount;
});
const description = computed(() =>
    price.value
        ? `${formatAmount(price.value)} ${$t({
              defaultMessage: 'one-off',
              id: 'on_demand_pricing_row.one_off_label',
              description: 'One-off label shown next to the price in an on-demand pricing row',
          })}`
        : '',
);
</script>

<template>
    <Section
        :content-background="selected ? 'none' : 'gray'"
        :content-classes="
            selected
                ? '!border-primary-600 ring-1 ring-primary-600'
                : undefined
        "
    >
        <PricingGroupContent :name="title" :description="description">
            <template #default>
                <Button
                    v-if="selected"
                    color="gray"
                    variant="outline"
                    size="sm"
                    icon-prefix="remove_shopping_cart"
                    :loading="loading"
                    @click="emit('toggle', pricing.id)"
                >
                    {{
                        $t({
                            defaultMessage: 'Remove',
                            id: 'on_demand_pricing_row.remove_button_label',
                            description: 'Label for the remove button in an on-demand pricing row',
                        })
                    }}
                </Button>
                <Button
                    v-else
                    color="primary"
                    size="sm"
                    icon-prefix="add"
                    :loading="loading"
                    @click="emit('toggle', pricing.id)"
                >
                    {{
                        $t({
                            defaultMessage: 'Add to cart',
                            id: 'on_demand_pricing_row.add_to_cart_button_label',
                            description:
                                'Label for the add to cart button in an on-demand pricing row',
                        })
                    }}
                </Button>
            </template>
        </PricingGroupContent>
    </Section>
</template>
