<script setup lang="ts">
import type { SolvimonInvoiceProps } from './SolvimonInvoice.types';
import InvoiceDetail from '@/views/InvoiceDetail/InvoiceDetail.vue';
import Provider from '@/components/Provider/Provider.vue';

const props = defineProps<Partial<SolvimonInvoiceProps>>();

if (!props.invoiceId) {
    throw new Error('invoiceId prop is required');
}
</script>

<template>
    <Provider :environment="environment" :token="token" :locale="locale">
        <InvoiceDetail
            v-if="invoiceId"
            :invoice-id="invoiceId"
            :show-customer-billing-information="showCustomerBillingInformation"
        />
    </Provider>
</template>
