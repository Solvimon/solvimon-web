<script setup lang="ts">
import { onMounted } from 'vue';
import { getApiError } from '@solvimon/ui';
import type { SolvimonBillingInformationFormEntryProps } from './BillingInformationForm.entry.types';
import { useCustomer } from '@/composables/useCustomer';

const props = defineProps<SolvimonBillingInformationFormEntryProps>();

const customerId = props.portalObject.customer_id;

const { customer, get, update } = useCustomer({ customerId });

onMounted(async () => {
    await get.execute();
});
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :is-loading="get.isPending.value || update.isPending.value"
        :update-customer="update"
        :api-error="getApiError(update.error)"
    />
</template>
