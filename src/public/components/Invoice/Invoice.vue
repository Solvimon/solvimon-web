<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { CustomerBillingInformation, InvoiceHeader, useIntl } from '@solvimon/solvimon-ui';
import type { InvoiceProps } from './Invoice.types';
import InvoiceBlock from '@/components/invoices/invoiceDetails/InvoiceBlock.vue';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';

const PaymentHistoryBlock = defineAsyncComponent(
    () => import('@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue'),
);

defineProps<InvoiceProps>();

const { $t } = useIntl();
</script>

<template>
    <div class="sv-invoice sv-root sv-component">
        <InvoiceHeader
            class="sv-invoice__header mb-6"
            :payment-attempts="payments ?? []"
            :invoice="invoice"
            :download-service="() => invoiceDownloadService(invoice.id)"
            :show-download-button="configuration.enableDownloadButton"
            variant="external"
        />

        <div class="sv-invoice__body flex flex-col gap-3 lg:flex-row lg:gap-6">
            <InvoiceBlock v-if="invoice" class="sv-invoice__main" :invoice="invoice" />

            <div class="sv-invoice__aside flex shrink-0 flex-col gap-8 lg:w-72 lg:gap-6">
                <InvoiceDetailsBlock class="sv-invoice__details" :invoice="invoice" />
                <PaymentHistoryBlock
                    v-if="configuration?.enablePaymentAttempts && payments?.length"
                    class="sv-invoice__payment-history"
                    :payment-attempts="payments"
                    :customer="invoice.customer"
                />
                <CustomerBillingInformation
                    v-if="configuration.enableCustomerBillingInformation"
                    class="sv-invoice__billing-information"
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
    </div>
</template>
