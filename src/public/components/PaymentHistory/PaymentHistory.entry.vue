<script setup lang="ts">
import PaymentHistory from './PaymentHistory.vue';
import PaymentHistoryEntryView from './PaymentHistory.entry.view.vue';
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('payment-history');

defineProps<SolvimonPaymentHistoryEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        :required-configuration="{ invoiceId: configuration?.invoiceId }"
        @error="(error) => $emit('error', error)"
    >
        <PaymentHistoryEntryView :key="configuration.invoiceId" v-bind="$props">
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
