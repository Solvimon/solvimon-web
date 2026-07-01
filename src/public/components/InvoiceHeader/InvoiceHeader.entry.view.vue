<script setup lang="ts">
import type { SolvimonInvoiceHeaderEntryProps } from './InvoiceHeader.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useInvoice } from '@/composables/useInvoice';
import { usePayments } from '@/composables/usePayments';

const props = defineProps<SolvimonInvoiceHeaderEntryProps>();

const invoice = useInvoice({ invoiceId: props.configuration.invoiceId });
const payments = usePayments();

const { isLoading } = useLoadInitialData(
    invoice.get(),
    payments.get(props.configuration.invoiceId),
);
</script>

<template>
    <slot
        name="default"
        :invoice="invoice.invoice.value"
        :invoice-download-service="invoice.downloadInvoicePdf"
        :payments="payments"
        :is-loading="isLoading"
    />
</template>
