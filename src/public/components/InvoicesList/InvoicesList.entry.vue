<script setup lang="ts">
import InvoicesList from './InvoicesList.vue';
import type { SolvimonInvoicesListEntryProps } from './InvoicesList.entry.types';
import InvoicesListView from './InvoicesList.entry.view.vue';

defineProps<Partial<SolvimonInvoicesListEntryProps>>();
</script>

<template>
    <InvoicesListView>
        <template #default="{ invoices }">
            <InvoicesList
                :configuration="configuration"
                :invoices="invoices.items.value"
                :is-loading="invoices.isPending.value"
                :has-more-items="invoices.hasNextBatch.value"
                @load-more="invoices.fetchMore"
            />
        </template>
    </InvoicesListView>
</template>
