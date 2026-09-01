<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceHeaderEntryProps } from './InvoiceHeader.entry.types';
import InvoiceHeader from './InvoiceHeader.vue';
import InvoiceEntryView from '@/components/invoices/InvoiceEntryView.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('invoice-header');

const props = defineProps<SolvimonInvoiceHeaderEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}

const resolvedProps = computed<SolvimonInvoiceHeaderEntryProps>(() => ({
    ...props,
    configuration: {
        enableDownloadButton: true,
        ...props.configuration,
    },
}));
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceEntryView :invoice-id="resolvedProps.configuration.invoiceId">
            <template #default="{ invoice, payments, isLoading, invoiceDownloadService }">
                <InvoiceHeader
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
