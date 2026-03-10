<script setup lang="ts">
import { unref } from 'vue';
import type { Customer } from '@solvimon/types';
import SubscriptionsList from './SubscriptionsList.vue';
import SubscriptionsListView from './SubscriptionsList.entry.view.vue';
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';

defineProps<Partial<SolvimonSubscriptionsListEntryProps>>();
</script>

<template>
    <SubscriptionsListView>
        <template #default="{ customer, subscriptions, paymentMethods, isLoading, loadMore }">
            <SubscriptionsList
                :customer="unref(customer) as Customer"
                :subscriptions="unref(subscriptions) ?? []"
                :payment-methods="unref(paymentMethods) ?? []"
                :is-loading="unref(isLoading)"
                :on-load-more="loadMore"
            />
        </template>
    </SubscriptionsListView>
</template>
