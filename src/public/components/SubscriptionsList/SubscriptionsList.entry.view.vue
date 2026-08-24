<script setup lang="ts">
import type { SolvimonSubscriptionsListEntryProps } from './SubscriptionsList.entry.types';
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
    customer.get.execute(),
    subscriptions.fetchInitial(),
    paymentMethods.fetchAll(),
);
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :subscriptions="subscriptions.items"
        :payment-methods="paymentMethods.items"
        :is-loading="isLoading"
        :load-more="subscriptions.fetchMore"
    />
</template>
