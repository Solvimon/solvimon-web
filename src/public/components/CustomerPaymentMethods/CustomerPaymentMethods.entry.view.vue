<script setup lang="ts">
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePaymentMethods } from '@/composables/usePaymentMethods';

const DEFAULT_MAX_ITEMS = 3;

const props = defineProps<SolvimonCustomerPaymentMethodsEntryProps>();

const customerId = props.portalObject.customer_id;

const paymentMethods = usePaymentMethods({
    customerId,
    pageSize: props.configuration?.maxItems || DEFAULT_MAX_ITEMS,
});
const { isLoading } = useLoadInitialData(paymentMethods.fetchInitial());
</script>

<template>
    <slot name="default" :payment-methods="paymentMethods.items.value" :is-loading="isLoading" />
</template>
