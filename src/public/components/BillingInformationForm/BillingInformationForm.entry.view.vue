<script setup lang="ts">
import { getApiError } from '@solvimon/solvimon-ui';
import type { SolvimonBillingInformationFormEntryProps } from './BillingInformationForm.entry.types';
import { useCustomer } from '@/composables/useCustomer';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonBillingInformationFormEntryProps>();

const customerId = props.portalObject.customer_id;

const { customer, get, update } = useCustomer({ customerId });

useLoadInitialData(get.execute());
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :is-loading="get.isPending.value || update.isPending.value"
        :update-customer="update"
        :api-error="update.error.value ? getApiError(update.error.value) : undefined"
    />
</template>
