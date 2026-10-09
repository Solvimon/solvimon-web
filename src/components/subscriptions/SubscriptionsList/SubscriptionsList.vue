<script setup lang="ts">
import { Section, Typography, useIntl, Button, ErrorNotification } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import type { SubscriptionsListEmits, SubscriptionsListProps } from './SubscriptionsList.types';
import SubscriptionsListItem from './SubscriptionsListItem.vue';

const props = withDefaults(defineProps<SubscriptionsListProps>(), {
    paymentMethods: () => [],
    hasError: false,
    hasMoreItems: false,
    isLoadingMore: false,
    showViewAllButton: true,
    showViewDetailsButton: false,
    showUpgradeButton: true,
    showCancelButton: true,
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
        class="sv-subscriptions-list"
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
                intent="subtle"
                icon-suffix="arrow_right_alt"
                class="sv-action sv-action--ghost sv-subscriptions-list__view-all"
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

        <ErrorNotification
            v-if="hasError"
            class="sv-subscriptions-list__error sv-error"
            :title="
                $t({
                    defaultMessage: 'We could not load your subscriptions. Please try again later.',
                    description:
                        'Error shown when the subscriptions in the subscriptions block fail to load',
                    id: 'customer_overview.subscriptions_block.load_error',
                })
            "
        />

        <Section
            v-if="!hasSubscriptions && !hasError"
            class="sv-empty-state sv-subscriptions-list__empty"
        >
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
            <Typography variant="body-xs" color="subtle">
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
        <div
            v-else-if="hasSubscriptions"
            class="sv-subscriptions-list__items grid grid-cols-1 gap-4"
        >
            <SubscriptionsListItem
                v-for="subscription in subscriptions"
                :key="subscription.id"
                :subscription="subscription"
                :payment-method="getPaymentMethod(subscription.payment_method_id)"
                :customer="customer!"
                :show-view-subscription-details-button="showViewDetailsButton"
                :show-upgrade-button="showUpgradeButton"
                :show-cancel-button="showCancelButton"
                @view-subscription-details="$emit('view-subscription-details', $event)"
                @subscription-changed="$emit('subscription-changed')"
            />
        </div>

        <Button
            v-if="hasMoreItems"
            intent="secondary"
            size="sm"
            class="sv-action sv-action--secondary sv-action--full-width sv-subscriptions-list__load-more mt-2 w-full"
            type="button"
            :loading="isLoadingMore"
            @click="$emit('load-more')"
        >
            {{
                $t({
                    defaultMessage: 'Load more',
                    description: 'The label for the button that loads more subscriptions',
                    id: 'customer_overview.subscriptions_block.load_more_button_label',
                })
            }}
        </Button>
    </Section>
</template>
