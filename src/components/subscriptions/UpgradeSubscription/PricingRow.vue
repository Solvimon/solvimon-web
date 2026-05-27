<script setup lang="ts">
import { Button, Typography, formatAmount, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { OnDemandPricing } from './UpgradeSubscription.types';

const props = defineProps<{
    pricing: OnDemandPricing;
    selected: boolean;
}>();

const emit = defineEmits<{
    (e: 'toggle-item', pricingItemId: string): void;
}>();

const { $t } = useIntl();

const title = computed(() => props.pricing.name ?? props.pricing.products?.[0]?.name ?? '—');
const description = computed(() => props.pricing.products?.[0]?.description);
const price = computed(() => props.pricing.items?.[0]?.configs?.[0]?.bands?.[0]?.fixed_amount);
const pricingItemId = computed(() => props.pricing.items?.[0]?.id);
</script>

<template>
    <div
        class="sv-pricing-list__row flex items-center justify-between gap-3 border-b p-1.5 transition-colors last:border-b-0"
        :class="
            selected
                ? 'sv-pricing-list__row--selected border-primary/80 bg-white shadow-[inset_0_0_0_1px_var(--sm-color-primary)]'
                : 'border-gray-200 bg-white'
        "
    >
        <div class="sv-pricing-list__content min-w-0 flex-1">
            <Typography variant="body-sm" weight="semibold" class="sv-pricing-list__name">{{
                title
            }}</Typography>
            <Typography
                v-if="description"
                variant="body-xs"
                shade="lighter"
                class="sv-pricing-list__description"
            >{{
                description
            }}</Typography>
            <div class="sv-pricing-list__price mt-0.5 flex items-center gap-1">
                <Typography v-if="price" variant="body-sm" shade="lighter">{{
                    formatAmount(price)
                }}</Typography>
                <Typography variant="body-sm" shade="lighter">{{
                    $t({
                        defaultMessage: 'one-off',
                        description: 'Label indicating a one-time charge on a pricing row',
                        id: 'upgrade_subscription.pricing_row.one_off_label',
                    })
                }}</Typography>
            </div>
        </div>

        <Button
            v-if="pricingItemId"
            size="sm"
            :variant="selected ? 'outline' : undefined"
            :color="selected ? 'gray' : 'primary'"
            :icon-prefix="selected ? 'remove_shopping_cart' : 'shopping_cart'"
            class="sv-action sv-pricing-list__action"
            type="button"
            @click="emit('toggle-item', pricingItemId)"
        >
            {{
                selected
                    ? $t({
                          defaultMessage: 'Remove',
                          description: 'Button to remove a pricing item from the cart',
                          id: 'upgrade_subscription.pricing_row.remove_button_label',
                      })
                    : $t({
                          defaultMessage: 'Add to cart',
                          description: 'Button to add a pricing item to the cart',
                          id: 'upgrade_subscription.pricing_row.add_button_label',
                      })
            }}
        </Button>
    </div>
</template>
