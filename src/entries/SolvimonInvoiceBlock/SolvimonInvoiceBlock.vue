<script setup lang="ts">
import type {
    SolvimonInvoiceBlockProps,
    SolvimonInvoiceBlockEmits,
} from './SolvimonInvoiceBlock.types';
import InvoiceBlockContent from '@/components/invoices/invoiceDetails/InvoiceBlockContent.vue';
import Provider from '@/components/providers/Provider/Provider.vue';

const props = defineProps<Partial<SolvimonInvoiceBlockProps>>();
defineEmits<SolvimonInvoiceBlockEmits>();

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
        <InvoiceBlockContent v-if="invoiceId" :invoice-id="invoiceId" />
    </Provider>
</template>
