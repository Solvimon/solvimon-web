<script setup lang="ts">
import type { SolvimonInvoiceEmits, SolvimonInvoiceProps } from './SolvimonInvoice.types';
import { COMPONENT_NAME } from './SolvimonInvoice.ce';
import InvoiceDetail from '@/views/InvoiceDetail/InvoiceDetail.vue';
import Provider from '@/components/providers/Provider/Provider.vue';

const props = defineProps<Partial<SolvimonInvoiceProps>>();
defineEmits<SolvimonInvoiceEmits>();

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
        <InvoiceDetail
            v-if="invoiceId"
            :invoice-id="invoiceId"
            :show-customer-billing-information="showCustomerBillingInformation"
        />
    </Provider>
</template>
