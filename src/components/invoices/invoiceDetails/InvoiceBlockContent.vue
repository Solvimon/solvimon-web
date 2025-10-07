<script setup lang="ts">
import InvoiceBlock from '@/components/invoices/invoiceDetails/InvoiceBlock.vue';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<{ invoiceId: string }>();

const { data, isPending } = useInvoiceData(props.invoiceId);
</script>

<template>
    <template v-if="!isPending && data?.invoice">
        <InvoiceBlock :invoice="data.invoice" />
    </template>
</template>
