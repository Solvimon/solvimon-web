<script setup lang="ts">
import { COMPONENT_NAME } from './SubscriptionsList.entry.ce';
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';
import { Provider } from '@/components/providers';
import { useCustomer } from '@/composables/useCustomer';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { useSubscriptionsList } from '@/composables/useSubscriptionsList';

const props = defineProps<SolvimonSubscriptionsListEntryProps>();

const customerId = props.portalObject.customer_id;

const customer = useCustomer({ customerId });
const subscriptions = useSubscriptionsList({ customerId });
const paymentMethods = usePaymentMethods({ customerId });

const { isLoading } = useLoadInitialData(
    customer.fetch(),
    subscriptions.fetchInitial(),
    paymentMethods.fetchAll(),
);
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
        <slot
            name="default"
            :customer="customer"
            :subscriptions="subscriptions.items"
            :payment-methods="paymentMethods.items"
            :is-loading="isLoading"
            :load-more="subscriptions.fetchMore"
        />
    </Provider>
</template>
