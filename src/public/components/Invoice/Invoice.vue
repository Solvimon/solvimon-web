<script setup lang="ts">
import { CustomerBillingInformation, InvoiceHeader, useIntl } from '@solvimon/solvimon-ui';
import type { InvoiceProps } from './Invoice.types';
import InvoiceBlock from '@/components/invoices/invoiceDetails/InvoiceBlock.vue';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';

defineProps<InvoiceProps>();

const { $t } = useIntl();
</script>

<template>
    <InvoiceHeader
        class="mb-6"
        :payment-attempts="payments ?? []"
        :invoice="invoice"
        :download-service="() => invoiceDownloadService(invoice.id)"
        :show-download-button="configuration.enableDownloadButton"
        variant="external"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:gap-6">
        <InvoiceBlock v-if="invoice" :invoice="invoice" />

        <div class="flex shrink-0 flex-col gap-8 lg:w-72 lg:gap-6">
            <InvoiceDetailsBlock :invoice="invoice" />
            <PaymentHistoryBlock
                v-if="configuration?.enablePaymentAttempts && payments?.length"
                :payment-attempts="payments"
                :customer="invoice.customer"
            />
            <CustomerBillingInformation
                v-if="configuration.enableCustomerBillingInformation"
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
