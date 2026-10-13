<script setup lang="ts">
import InvoiceDetails from './InvoiceDetails.vue';
import InvoiceDetailsEntryView from './InvoiceDetails.entry.view.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('invoice-details');

defineProps<SolvimonInvoiceDetailsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        :required-configuration="{ invoiceId: configuration?.invoiceId }"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceDetailsEntryView :key="configuration.invoiceId" v-bind="$props">
            <template #default="{ invoice }">
                <InvoiceDetails v-if="invoice" :invoice="invoice" />
            </template>
        </InvoiceDetailsEntryView>
    </EntryProvider>
</template>
