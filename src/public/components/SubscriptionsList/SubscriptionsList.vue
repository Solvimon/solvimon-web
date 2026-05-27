<script setup lang="ts">
import type { SubscriptionsListEmits, SubscriptionsListProps } from './SubscriptionsList.types';
import SubscriptionsList from '@/components/subscriptions/SubscriptionsList/SubscriptionsList.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useActionDispatchProvider } from '@/components/providers';

defineProps<SubscriptionsListProps>();
defineEmits<SubscriptionsListEmits>();

const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-subscriptions-list sv-root sv-component sv-loading min-h-[100px]"
        data-testid="subscriptions-list-skeleton"
    />
    <SubscriptionsList
        v-else-if="customer"
        class="sv-subscriptions-list sv-root sv-component"
        :customer="customer"
        :subscriptions="subscriptions"
        :payment-methods="paymentMethods"
        :is-loading="isLoading"
        :show-view-all-button="configuration?.showViewAllButton"
        :show-view-details-button="configuration?.showViewDetailsButton"
        :show-cancel-button="configuration?.showCancelButton"
        :show-renew-button="configuration?.showRenewButton"
        @view-subscription-details="
            dispatchAction({
                action: 'view-subscription-details',
                data: { subscriptionId: $event.subscriptionId },
            })
        "
        @view-all-subscriptions="dispatchAction({ action: 'view-all-subscriptions' })"
        @cancel-subscription="
            dispatchAction({
                action: 'cancel-subscription',
                data: { subscriptionId: $event.subscriptionId },
            })
        "
        @renew-subscription="
            dispatchAction({
                action: 'renew-subscription',
                data: { subscriptionId: $event.subscriptionId },
            })
        "
        @load-more="$emit('load-more')"
    />
</template>
