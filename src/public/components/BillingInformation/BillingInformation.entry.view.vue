<script setup lang="ts">
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import { useCustomer } from '@/composables/useCustomer';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonBillingInformationEntryProps>();

const customerId = props.portalObject.customer_id;

const customer = useCustomer({ customerId });

const { isLoading } = useLoadInitialData(customer.get.execute());
</script>

<template>
    <slot name="default" :customer="customer" :is-loading="isLoading" />
</template>
