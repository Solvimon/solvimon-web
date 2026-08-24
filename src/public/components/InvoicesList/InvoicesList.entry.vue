<script setup lang="ts">
import InvoicesList from './InvoicesList.vue';
import type { SolvimonInvoicesListEntryProps } from './InvoicesList.entry.types';
import InvoicesListView from './InvoicesList.entry.view.vue';
import { COMPONENT_NAME } from './InvoicesList.entry.ce';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonInvoicesListEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <InvoicesListView v-bind="$props">
            <template #default="{ invoices, isLoading }">
                <InvoicesList
                    :configuration="configuration"
                    :invoices="invoices.items.value"
                    :is-loading="isLoading"
                    :has-more-items="invoices.hasNextBatch.value"
                    @load-more="invoices.fetchMore"
                />
            </template>
        </InvoicesListView>
    </EntryProvider>
</template>
