<script setup lang="ts">
import SubscriptionsList from './SubscriptionsList.vue';
import SubscriptionsListView from './SubscriptionsList.entry.view.vue';
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';

defineProps<Partial<SolvimonSubscriptionsListEntryProps>>();
</script>

<template>
    <SubscriptionsListView>
        <template #default="{ customer, subscriptions, paymentMethods, isLoading, loadMore }">
            <SubscriptionsList
                :configuration="configuration"
                :customer="customer"
                :subscriptions="subscriptions.value"
                :payment-methods="paymentMethods.value"
                :is-loading="isLoading"
                @load-more="loadMore"
            />
        </template>
    </SubscriptionsListView>
</template>
