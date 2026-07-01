<script setup lang="ts">
import { InvoiceHeader } from '@solvimon/solvimon-ui';
import type { InvoiceHeaderProps } from './InvoiceHeader.types';

defineProps<InvoiceHeaderProps>();
</script>

<template>
    <InvoiceHeader
        class="sv-invoice-header sv-root sv-component"
        :payment-attempts="payments ?? []"
        :invoice="invoice"
        :download-service="() => invoiceDownloadService(invoice.id)"
        :show-download-button="configuration.enableDownloadButton"
        variant="external"
    />
</template>
