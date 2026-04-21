<script setup lang="ts">
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<SolvimonPaymentHistoryEntryProps>();

const invoiceData = useInvoiceData(props.configuration.invoiceId);
</script>

<template>
    <slot
        name="default"
        :invoice="invoiceData.data.value?.invoice"
        :payment-attempts="invoiceData.data.value?.paymentAttempts.data"
        :is-loading="invoiceData.isPending.value"
    />
</template>
