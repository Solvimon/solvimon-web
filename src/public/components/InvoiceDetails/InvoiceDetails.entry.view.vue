<script setup lang="ts">
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<SolvimonInvoiceDetailsEntryProps>();

const invoiceData = useInvoiceData(props.configuration.invoiceId);
</script>

<template>
    <slot
        name="default"
        :invoice="invoiceData.data.value?.invoice"
        :is-loading="invoiceData.isPending.value"
    />
</template>
