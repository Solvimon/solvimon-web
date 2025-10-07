<script setup lang="ts">
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<{ invoiceId: string }>();

const { data, isPending } = useInvoiceData(props.invoiceId);
</script>

<template>
    <template v-if="!isPending && data?.invoice">
        <PaymentHistoryBlock
            v-if="data?.paymentAttempts.data.length"
            :payment-attempts="data?.paymentAttempts.data"
            :customer="data.invoice.customer"
        />
    </template>
</template>
