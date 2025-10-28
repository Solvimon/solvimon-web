<script setup lang="ts">
import type {
    SolvimonInvoiceDetailsBlockEmits,
    SolvimonInvoiceDetailsBlockProps,
} from './SolvimonInvoiceDetailsBlock.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import InvoiceDetailsBlockContent from '@/components/invoices/invoiceDetails/InvoiceDetailsBlockContent.vue';

const props = defineProps<Partial<SolvimonInvoiceDetailsBlockProps>>();
defineEmits<SolvimonInvoiceDetailsBlockEmits>();

if (!props.environment) {
    throw new Error('environment props are required');
}

if (!props.invoiceId) {
    throw new Error('invoiceId prop is required');
}
</script>

<template>
    <Provider
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-url-types="['INVOICE', 'CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceDetailsBlockContent v-if="invoiceId" :invoice-id="invoiceId" />
    </Provider>
</template>
