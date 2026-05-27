<script setup lang="ts">
import type { PaymentHistoryProps } from './PaymentHistory.types';
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

defineProps<PaymentHistoryProps>();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-history sv-root sv-component sv-loading min-h-[100px]"
        data-testid="payment-history-skeleton"
    />
    <PaymentHistoryBlock
        v-else-if="paymentAttempts.length"
        class="sv-payment-history sv-root sv-component"
        :payment-attempts="paymentAttempts"
        :customer="customer"
    />
</template>
