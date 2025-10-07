<script setup lang="ts">
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<{ invoiceId: string }>();

const { data, isPending } = useInvoiceData(props.invoiceId);
</script>

<template>
    <template v-if="!isPending && data?.invoice">
        <InvoiceDetailsBlock :invoice="data.invoice" />
    </template>
</template>
