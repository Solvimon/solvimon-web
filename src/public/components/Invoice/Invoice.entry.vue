<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceEntryProps } from './Invoice.entry.types';
import Invoice from './Invoice.vue';
import InvoiceEntryView from '@/components/invoices/InvoiceEntryView.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('invoice');

const props = defineProps<SolvimonInvoiceEntryProps>();

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
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        :required-configuration="{ invoiceId: configuration?.invoiceId }"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceEntryView
            :key="resolvedProps.configuration.invoiceId"
            :invoice-id="resolvedProps.configuration.invoiceId"
        >
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
