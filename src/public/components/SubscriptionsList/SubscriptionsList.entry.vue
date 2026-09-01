<script setup lang="ts">
import SubscriptionsList from './SubscriptionsList.vue';
import SubscriptionsListView from './SubscriptionsList.entry.view.vue';
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('subscriptions-list');

defineProps<SolvimonSubscriptionsListEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionsListView v-bind="$props">
            <template #default="{ customer, subscriptions, paymentMethods, isLoading, loadMore }">
                <SubscriptionsList
                    :configuration="configuration"
                    :customer="customer.customer.value"
                    :subscriptions="subscriptions.value"
                    :payment-methods="paymentMethods.value"
                    :is-loading="isLoading"
                    @load-more="loadMore"
                />
            </template>
        </SubscriptionsListView>
    </EntryProvider>
</template>
