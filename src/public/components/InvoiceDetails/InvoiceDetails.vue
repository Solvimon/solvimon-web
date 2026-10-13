<script setup lang="ts">
import type { InvoiceDetailsProps } from './InvoiceDetails.types';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';

defineProps<InvoiceDetailsProps>();
</script>

<template>
    <InvoiceDetailsBlock class="sv-invoice-details sv-root sv-component" :invoice="invoice" />
</template>
