<script setup lang="ts">
import InvoiceDetails from './InvoiceDetails.vue';
import InvoiceDetailsEntryView from './InvoiceDetails.entry.view.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { COMPONENT_NAME } from './InvoiceDetails.entry.ce';
import { EntryProvider } from '@/components/providers';

const props = defineProps<SolvimonInvoiceDetailsEntryProps>();

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
        <InvoiceDetailsEntryView v-bind="$props">
            <template #default="{ invoice, isLoading }">
                <InvoiceDetails
                    v-if="invoice"
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :configuration="configuration"
                />
            </template>
        </InvoiceDetailsEntryView>
    </EntryProvider>
</template>
