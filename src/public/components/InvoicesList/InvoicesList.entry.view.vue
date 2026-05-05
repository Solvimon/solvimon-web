<script setup lang="ts">
import type { SolvimonInvoicesListEntryProps } from './InvoicesList.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useInvoicesList } from '@/composables/useInvoicesList';

const DEFAULT_BATCH_SIZE = 15;

const props = defineProps<SolvimonInvoicesListEntryProps>();

const customerId = props.portalObject!.customer_id;

const invoices = useInvoicesList({
    customerId,
    batchSize: props.configuration?.pagination?.batchSize || DEFAULT_BATCH_SIZE,
});

const { isLoading } = useLoadInitialData(invoices.fetchInitial());
</script>

<template>
    <slot name="default" :is-loading="isLoading" :invoices="invoices" />
</template>
