<script setup lang="ts">
import type { PaymentHistoryProps } from './PaymentHistory.types';
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';

defineProps<PaymentHistoryProps>();
</script>

<template>
    <PaymentHistoryBlock
        v-if="paymentAttempts.length"
        class="sv-payment-history sv-root sv-component"
        :payment-attempts="paymentAttempts"
        :customer="customer"
    />
</template>
