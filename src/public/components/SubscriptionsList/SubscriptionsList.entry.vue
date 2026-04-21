<script setup lang="ts">
import SubscriptionsList from './SubscriptionsList.vue';
import SubscriptionsListView from './SubscriptionsList.entry.view.vue';
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';
import { COMPONENT_NAME } from './SubscriptionsList.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonSubscriptionsListEntryProps>();
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        @error="(error) => $emit('error', error)"
    >
        <SubscriptionsListView v-bind="$props">
            <template #default="{ customer, subscriptions, paymentMethods, isLoading, loadMore }">
                <SubscriptionsList
                    :configuration="configuration"
                    :customer="customer.data.value"
                    :subscriptions="subscriptions.value"
                    :payment-methods="paymentMethods.value"
                    :is-loading="isLoading"
                    @load-more="loadMore"
                />
            </template>
        </SubscriptionsListView>
    </Provider>
</template>
