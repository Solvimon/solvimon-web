<script setup lang="ts">
import { InvoiceHeader } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { InvoiceHeaderProps } from './InvoiceHeader.types';
import { withInvoiceTimezone } from '@/utils/invoiceState';

const props = defineProps<InvoiceHeaderProps>();

const datedInvoice = computed(() => withInvoiceTimezone(props.invoice));
</script>

<template>
    <InvoiceHeader
        class="sv-invoice-header sv-root sv-component"
        :payment-attempts="payments ?? []"
        :invoice="datedInvoice"
        :download-service="() => invoiceDownloadService(invoice)"
        :show-download-button="configuration.enableDownloadButton"
        variant="external"
    />
</template>
