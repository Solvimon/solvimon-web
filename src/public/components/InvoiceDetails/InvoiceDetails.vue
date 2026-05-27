<script setup lang="ts">
import type { InvoiceDetailsProps } from './InvoiceDetails.types';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

defineProps<InvoiceDetailsProps>();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-invoice-details sv-root sv-component sv-loading min-h-[100px]"
        data-testid="invoice-details-skeleton"
    />
    <InvoiceDetailsBlock v-else class="sv-invoice-details sv-root sv-component" :invoice="invoice" />
</template>
