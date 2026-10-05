<script setup lang="ts">
import {
    Button,
    Section,
    Typography,
    useChargeOnDemandPriceLabel,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { OnDemandItemsCardEmits, OnDemandItemsCardProps } from './OnDemandItemsCard.types';

defineProps<OnDemandItemsCardProps>();
defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();
const { getPriceLabel } = useChargeOnDemandPriceLabel();
</script>

<template>
    <Section
        class="sv-on-demand-items-card"
        content-background="none"
        no-border
        no-spacing
        :title="
            $t({
                defaultMessage: 'On-demand items',
                id: 'on_demand_items_card.title',
                description:
                    'Title for the block that offers the on-demand items of a subscription',
            })
        "
    >
        <Section class="sv-on-demand-items-card__body">
            <ul class="sv-on-demand-items-card__items grid grid-cols-1 gap-3">
                <li
                    v-for="item in items"
                    :key="item.pricingItemId"
                    class="sv-on-demand-items-card__item grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4"
                >
                    <Typography
                        tag="h3"
                        variant="heading-3"
                        no-spacing
                        class="sv-on-demand-items-card__item-name break-words"
                        >{{ item.name }}</Typography
                    >
                    <Typography
                        v-if="getPriceLabel(item)"
                        tag="span"
                        variant="body-sm"
                        color="subtle"
                        class="sv-on-demand-items-card__item-price whitespace-nowrap text-right"
                        >{{ getPriceLabel(item) }}</Typography
                    >
                </li>
            </ul>

            <Button
                class="sv-action sv-action--primary sv-on-demand-items-card__order mt-4 w-full"
                type="button"
                @click="$emit('order')"
            >
                {{
                    $t({
                        defaultMessage: 'Order items',
                        id: 'on_demand_items_card.order_button.label',
                        description: 'Label for the button that opens the on-demand order form',
                    })
                }}
            </Button>
        </Section>
    </Section>
</template>
