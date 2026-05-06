<script setup lang="ts">
import { Section, Typography, useIntl, Button } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import type { SubscriptionsListEmits, SubscriptionsListProps } from './SubscriptionsList.types';
import SubscriptionsListItem from './SubscriptionsListItem.vue';

const props = withDefaults(defineProps<SubscriptionsListProps>(), {
    paymentMethods: () => [],
    showViewAllButton: true,
    showViewDetailsButton: true,
    showCancelButton: true,
    showRenewButton: true,
});
defineEmits<SubscriptionsListEmits>();

const { $t } = useIntl();

const hasSubscriptions = computed<boolean>(() => props.subscriptions.length > 0);

const getPaymentMethod = (paymentMethodId?: PaymentMethod['id']): PaymentMethod | undefined => {
    if (!paymentMethodId) return undefined;

    return props.paymentMethods.find(({ id }) => id === paymentMethodId);
};

const isViewAllButtonVisible = computed<boolean>(() => props.showViewAllButton);
</script>

<template>
    <Section
        no-spacing
        no-border
        :title="
            $t(
                {
                    defaultMessage:
                        '{count, plural, one {My subscription} other {My subscriptions}}',
                    description: 'Title for the subscriptions block on the customer overview page',
                    id: 'customer_overview.subscriptions_block.title',
                },
                { count: String(subscriptions.length) },
            )
        "
    >
        <template v-if="isViewAllButtonVisible" #right>
            <Button
                size="sm"
                variant="ghost"
                color="gray"
                icon-suffix="arrow_right_alt"
                type="button"
                @click="$emit('view-all-subscriptions')"
                >{{
                    $t({
                        defaultMessage: 'View all',
                        description: 'The text for the view all subscriptions button',
                        id: 'customer_overview.subscriptions_block.view_all_button_label',
                    })
                }}</Button
            >
        </template>

        <Section v-if="!hasSubscriptions">
            <Typography tag="h3" variant="heading-3">
                {{
                    $t({
                        defaultMessage: 'No subscriptions',
                        description:
                            'Title for the my subscriptions block on the customer overview page',
                        id: 'customer_overview.subscriptions_block.no_active_subscription_title',
                    })
                }}</Typography
            >
            <Typography variant="body-xs" shade="lighter">
                {{
                    $t({
                        defaultMessage: 'There’s no active subscription to display.',
                        description:
                            'Text that is being displayed when there is no active subscription in the subscriptions block',
                        id: 'customer_overview.subscriptions_block.no_active_subscription_content',
                    })
                }}</Typography
            >
        </Section>
        <div v-else class="grid grid-cols-1 gap-4">
            <SubscriptionsListItem
                v-for="subscription in subscriptions"
                :key="subscription.id"
                :subscription="subscription"
                :payment-method="getPaymentMethod(subscription.payment_method_id)"
                :customer="customer!"
                :show-view-subscription-details-button="showViewDetailsButton"
                :show-cancel-subscription-button="showCancelButton"
                :show-renew-subscription-button="showRenewButton"
                @view-subscription-details="$emit('view-subscription-details', $event)"
                @cancel-subscription="$emit('cancel-subscription', $event)"
                @renew-subscription="$emit('renew-subscription', $event)"
            />
        </div>
    </Section>
</template>
