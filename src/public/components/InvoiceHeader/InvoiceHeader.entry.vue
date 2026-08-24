<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceHeaderEntryProps } from './InvoiceHeader.entry.types';
import InvoiceHeaderEntryView from './InvoiceHeader.entry.view.vue';
import InvoiceHeader from './InvoiceHeader.vue';
import { COMPONENT_NAME } from './InvoiceHeader.entry.ce';
import { EntryProvider } from '@/components/providers';

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
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceHeaderEntryView v-bind="resolvedProps">
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
        </InvoiceHeaderEntryView>
    </EntryProvider>
</template>
