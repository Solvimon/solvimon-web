<script setup lang="ts">
import { computed } from 'vue';
import {
    Button,
    Section,
    Typography,
    useChargeOnDemandPriceLabel,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { OnDemandItemsCardEmits, OnDemandItemsCardProps } from './OnDemandItemsCard.types';
import LimitedList from '@/components/shared/LimitedList/LimitedList.vue';

const MAX_VISIBLE_ITEMS = 2;

const props = defineProps<OnDemandItemsCardProps>();
defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();
const { getPriceLabel } = useChargeOnDemandPriceLabel();

const itemsWithPrices = computed(() =>
    props.items.map((item) => ({ item, priceLabel: getPriceLabel(item) })),
);
</script>

<template>
    <Section
        class="sv-on-demand-items-card"
        content-background="none"
        no-border
        no-spacing
        :title="
            $t({
                defaultMessage: 'Available on demand items',
                id: 'on_demand_items_card.title',
                description:
                    'Title for the block that offers the on-demand items of a subscription',
            })
        "
    >
        <template #right>
            <Button
                class="sv-action sv-action--secondary sv-on-demand-items-card__order"
                type="button"
                size="sm"
                intent="secondary"
                @click="$emit('order')"
            >
                {{
                    $t({
                        defaultMessage: 'Purchase',
                        id: 'on_demand_items_card.order_button.label',
                        description: 'Label for the button that opens the on-demand order form',
                    })
                }}
            </Button>
        </template>

        <LimitedList
            class="sv-on-demand-items-card__items"
            :items="itemsWithPrices"
            :limit="MAX_VISIBLE_ITEMS"
            :item-key="({ item }) => item.pricingItemId"
            item-class="sv-on-demand-items-card__item"
            more-class="sv-on-demand-items-card__more"
        >
            <template #item="{ item: { item, priceLabel } }">
                <Section no-spacing content-classes="flex flex-col px-4 py-3">
                    <Typography
                        tag="span"
                        weight="semibold"
                        no-spacing
                        class="sv-on-demand-items-card__item-name break-words"
                        >{{ item.name }}</Typography
                    >
                    <Typography
                        v-if="priceLabel"
                        tag="span"
                        variant="body-sm"
                        color="subtle"
                        no-spacing
                        class="sv-on-demand-items-card__item-price"
                        >{{ priceLabel }}</Typography
                    >
                </Section>
            </template>
            <template #more="{ count }">{{
                $t(
                    {
                        defaultMessage: '+ {count} available',
                        id: 'on_demand_items_card.more_available',
                        description:
                            'Shown below the first on-demand items with the number of items not listed',
                    },
                    { count: String(count) },
                )
            }}</template>
        </LimitedList>
    </Section>
</template>
