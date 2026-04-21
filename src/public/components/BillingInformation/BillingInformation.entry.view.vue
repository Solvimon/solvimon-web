<script setup lang="ts">
import type { SolvimonBillingInformationEntryProps } from './BillingInformation.entry.types';
import { useCustomer } from '@/composables/useCustomer';

const props = defineProps<SolvimonBillingInformationEntryProps>();

const customerId = props.portalObject.customer_id;

const customer = useCustomer({ customerId });
</script>

<template>
    <slot name="default" :customer="customer" />
</template>
