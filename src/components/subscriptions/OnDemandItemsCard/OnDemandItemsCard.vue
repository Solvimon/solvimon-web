<script setup lang="ts">
import { Button, Section, Typography, formatAmount, useIntl } from '@solvimon/solvimon-ui';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import type { OnDemandItemsCardEmits, OnDemandItemsCardProps } from './OnDemandItemsCard.types';

defineProps<OnDemandItemsCardProps>();
defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();

const getPriceLabel = (item: ChargeOnDemandItem) => {
    if (!item.price) {
        return undefined;
    }
    const price = formatAmount(item.price);

    return item.priceType === 'FLAT'
        ? $t(
              {
                  defaultMessage: '{price} per unit',
                  id: 'on_demand_items_card.item.price_per_unit',
                  description: 'The listed price of an on-demand item charged per unit',
              },
              { price },
          )
        : $t(
              {
                  defaultMessage: '{price} one-off',
                  id: 'on_demand_items_card.item.price_one_off',
                  description: 'The listed price of an on-demand item charged once',
              },
              { price },
          );
};
</script>

<template>
    <Section
        class="sv-on-demand-items-card"
        :title="
            $t({
                defaultMessage: 'On-demand items',
                id: 'on_demand_items_card.title',
                description:
                    'Title for the block that offers the on-demand items of a subscription',
            })
        "
    >
        <div class="sv-on-demand-items-card__body flex flex-col gap-3">
            <ul class="sv-on-demand-items-card__items flex flex-col gap-2">
                <li
                    v-for="item in items"
                    :key="item.pricingItemId"
                    class="sv-on-demand-items-card__item flex items-baseline justify-between gap-4"
                >
                    <Typography tag="span" variant="body-sm" no-spacing>
                        {{ item.name }}
                    </Typography>
                    <Typography
                        v-if="getPriceLabel(item)"
                        tag="span"
                        variant="body-sm"
                        color="secondary"
                        no-spacing
                        class="shrink-0"
                    >
                        {{ getPriceLabel(item) }}
                    </Typography>
                </li>
            </ul>
            <Button
                class="sv-action sv-action--primary sv-on-demand-items-card__order w-full"
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
        </div>
    </Section>
</template>
