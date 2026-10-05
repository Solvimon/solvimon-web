<script setup lang="ts">
import { Button, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { OnDemandItemsCardEmits, OnDemandItemsCardProps } from './OnDemandItemsCard.types';
import { getSubscriptionName } from '@/utils/subscription';

const props = defineProps<OnDemandItemsCardProps>();
defineEmits<OnDemandItemsCardEmits>();

const { $t } = useIntl();

const subscriptionName = computed(() =>
    getSubscriptionName({
        subscription: props.subscription,
        fallback: $t({
            defaultMessage: 'your subscription',
            description:
                'Stands in for the subscription name on the on-demand items block when the subscription has none',
            id: 'on_demand_items_card.subscription_name_fallback',
        }),
    }),
);
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
                    $t(
                        {
                            defaultMessage:
                                'Make a one-off purchase of on-demand items in {subscription}.',
                            id: 'on_demand_items_card.description',
                            description:
                                'Explains what on-demand items are, on the block that offers them',
                        },
                        { subscription: subscriptionName },
                    )
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
