<script setup lang="ts">
import { Button, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { OnDemandItemsCardEmits } from './OnDemandItemsCard.types';

defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();
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
            <Typography
                tag="p"
                variant="body-sm"
                color="secondary"
                no-spacing
                class="sv-on-demand-items-card__description"
            >
                {{
                    $t({
                        defaultMessage:
                            'Order one-off items, like consulting hours or an onboarding package. You pay once, today.',
                        id: 'on_demand_items_card.description',
                        description:
                            'Explains what on-demand items are, on the block that offers them',
                    })
                }}
            </Typography>
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
