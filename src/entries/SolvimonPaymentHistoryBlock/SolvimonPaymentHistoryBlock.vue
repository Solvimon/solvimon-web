<script setup lang="ts">
import type {
    SolvimonPaymentHistoryProps,
    SolvimonPaymentHistoryEmits,
} from './SolvimonPaymentHistoryBlock.types';
import { COMPONENT_NAME } from './SolvimonPaymentHistoryBlock.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import PaymentHistoryBlockContent from '@/components/invoices/invoiceDetails/PaymentHistoryBlockContent.vue';

const props = defineProps<Partial<SolvimonPaymentHistoryProps>>();
defineEmits<SolvimonPaymentHistoryEmits>();

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
        <PaymentHistoryBlockContent v-if="invoiceId" :invoice-id="invoiceId" />
    </Provider>
</template>
