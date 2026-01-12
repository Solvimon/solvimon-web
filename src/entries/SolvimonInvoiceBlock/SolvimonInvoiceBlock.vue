<script setup lang="ts">
import type {
    SolvimonInvoiceBlockProps,
    SolvimonInvoiceBlockEmits,
} from './SolvimonInvoiceBlock.types';
import InvoiceBlockContent from '@/components/invoices/invoiceDetails/InvoiceBlockContent.vue';
import Provider from '@/components/providers/Provider/Provider.vue';
import { COMPONENT_NAME } from './SolvimonInvoiceBlock.ce';

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
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-types="['INVOICE', 'CUSTOMER']"
        :portal-object="portalObject"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceBlockContent v-if="invoiceId" :invoice-id="invoiceId" />
    </Provider>
</template>
