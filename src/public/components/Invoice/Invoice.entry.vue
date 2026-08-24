<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceEntryProps } from './Invoice.entry.types';
import { COMPONENT_NAME } from './Invoice.entry.ce';
import Invoice from './Invoice.vue';
import InvoiceEntryView from '@/components/invoices/InvoiceEntryView.vue';
import { EntryProvider } from '@/components/providers';

const props = defineProps<SolvimonInvoiceEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}

const resolvedProps = computed<SolvimonInvoiceEntryProps>(() => ({
    ...props,
    configuration: {
        enableCustomerBillingInformation: true,
        enableDownloadButton: true,
        enablePaymentAttempts: true,
        ...props.configuration,
    },
}));
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceEntryView :invoice-id="resolvedProps.configuration.invoiceId">
            <template #default="{ invoice, payments, isLoading, invoiceDownloadService }">
                <Invoice
                    v-if="invoice"
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :invoice-download-service="invoiceDownloadService"
                    :payments="payments.payments.value"
                    :configuration="resolvedProps.configuration"
                />
            </template>
        </InvoiceEntryView>
    </EntryProvider>
</template>
