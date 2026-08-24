<script setup lang="ts">
import type { Invoice } from '@solvimon/solvimon-types';
import { useInvoice } from '@/composables/useInvoice';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePayments } from '@/composables/usePayments';

const props = defineProps<{ invoiceId: Invoice['id'] }>();

const invoice = useInvoice({ invoiceId: props.invoiceId });
const payments = usePayments();

const { isLoading } = useLoadInitialData(invoice.get(), payments.get(props.invoiceId));
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
