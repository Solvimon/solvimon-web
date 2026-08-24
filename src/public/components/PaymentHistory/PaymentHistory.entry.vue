<script setup lang="ts">
import PaymentHistory from './PaymentHistory.vue';
import PaymentHistoryEntryView from './PaymentHistory.entry.view.vue';
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';
import { COMPONENT_NAME } from './PaymentHistory.entry.ce';
import { EntryProvider } from '@/components/providers';

const props = defineProps<SolvimonPaymentHistoryEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <PaymentHistoryEntryView v-bind="$props">
            <template #default="{ invoice, paymentAttempts, isLoading }">
                <PaymentHistory
                    v-if="invoice && paymentAttempts"
                    :is-loading="isLoading"
                    :customer="invoice.customer"
                    :payment-attempts="paymentAttempts"
                    :configuration="configuration"
                />
            </template>
        </PaymentHistoryEntryView>
    </EntryProvider>
</template>
