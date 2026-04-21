<script setup lang="ts">
import type { InvoiceProps } from './Invoice.types';
import InvoiceDetail from '@/views/InvoiceDetail/InvoiceDetail.vue';

defineProps<InvoiceProps>();
</script>

<template>
    <InvoiceDetail
        :invoice="invoice"
        :payment-attempts="payments"
        :download-service="invoiceDownloadService"
        :show-download-button="configuration?.enableDownloadButton"
        :show-customer-billing-information="configuration?.enableCustomerBillingInformation"
        :show-payment-attempts="configuration?.enablePaymentAttempts"
    />
</template>
