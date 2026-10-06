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

const MAX_VISIBLE_ITEMS = 2;

const props = defineProps<OnDemandItemsCardProps>();
defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();
const { getPriceLabel } = useChargeOnDemandPriceLabel();

const visibleItems = computed(() =>
    props.items.slice(0, MAX_VISIBLE_ITEMS).map((item) => ({
        item,
        priceLabel: getPriceLabel(item),
    })),
);

const hiddenItemCount = computed(() => Math.max(props.items.length - MAX_VISIBLE_ITEMS, 0));
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

        <ul class="sv-on-demand-items-card__items grid grid-cols-1 gap-1">
            <li
                v-for="{ item, priceLabel } in visibleItems"
                :key="item.pricingItemId"
                class="sv-on-demand-items-card__item"
            >
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
            </li>
            <li v-if="hiddenItemCount > 0" class="sv-on-demand-items-card__more">
                <Section no-spacing content-classes="px-4 py-3 text-center">
                    <Typography tag="span" weight="semibold" color="secondary" no-spacing>
                        {{
                            $t(
                                {
                                    defaultMessage: '+ {count} available',
                                    id: 'on_demand_items_card.more_available',
                                    description:
                                        'Shown below the first on-demand items with the number of items not listed',
                                },
                                { count: String(hiddenItemCount) },
                            )
                        }}
                    </Typography>
                </Section>
            </li>
        </ul>
    </Section>
</template>
