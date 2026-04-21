<script setup lang="ts">
import { InvoiceHeader, CustomerBillingInformation, useIntl } from '@solvimon/ui';
import { type InvoiceDetailProps } from './InvoiceDetail.types';
import InvoiceBlock from '@/components/invoices/invoiceDetails/InvoiceBlock.vue';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';

withDefaults(defineProps<InvoiceDetailProps>(), {
    showCustomerBillingInformation: true,
    showPaymentAttempts: true,
    showDownloadButton: true,
    paymentAttempts: () => [],
});

const { $t } = useIntl();
</script>

<template>
    <InvoiceHeader
        class="mb-6"
        :payment-attempts="paymentAttempts"
        :invoice="invoice"
        :download-service="() => downloadService(invoice.id)"
        :show-download-button="showDownloadButton"
        variant="external"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:gap-6">
        <InvoiceBlock v-if="invoice" :invoice="invoice" />

        <div class="flex shrink-0 flex-col gap-8 lg:w-72 lg:gap-6">
            <InvoiceDetailsBlock :invoice="invoice" />
            <PaymentHistoryBlock
                v-if="showPaymentAttempts && paymentAttempts.length"
                :payment-attempts="paymentAttempts"
                :customer="invoice.customer"
            />
            <CustomerBillingInformation
                v-if="showCustomerBillingInformation"
                :customer="invoice.customer"
                :title="
                    $t({
                        defaultMessage: 'Your billing information',
                        description:
                            'Title for the billing information on the detailed invoice view',
                        id: 'sdk.invoice_details.customer_billing_information.title',
                    })
                "
            />
        </div>
    </div>
</template>
