<script setup lang="ts">
import { InvoiceHeader, CustomerBillingInformation, useIntl } from '@solvimon/ui';
import type { InvoiceDetailProps } from './InvoiceDetail.types';
import InvoiceBlock from '@/components/invoices/invoiceDetails/InvoiceBlock.vue';
import InvoiceDetailsBlock from '@/components/invoices/invoiceDetails/InvoiceDetailsBlock.vue';
import { createInvoicesService } from '@/services/invoices';
import { useData } from '@/utils/useData';
import { createPaymentsService } from '@/services/payments';
import PaymentHistoryBlock from '@/components/invoices/invoiceDetails/PaymentHistoryBlock.vue';

const props = withDefaults(defineProps<InvoiceDetailProps>(), {
    showCustomerBillingInformation: true,
});

const { $t } = useIntl();

const { getInvoice, getInvoicePdf } = createInvoicesService();
const { getPayments } = createPaymentsService();

const { data, isPending } = useData({
    getData: async () => {
        const [invoice, paymentAttempts] = await Promise.all([
            getInvoice(props.invoiceId),
            getPayments(props.invoiceId),
        ]);
        return {
            invoice,
            paymentAttempts,
        };
    },
});
</script>

<template>
    <template v-if="!isPending && data?.invoice">
        <InvoiceHeader
            class="mb-6"
            :payment-attempts="data?.paymentAttempts.data"
            :invoice="data.invoice"
            :download-service="() => getInvoicePdf(invoiceId)"
            variant="external"
        />

        <div class="flex flex-col lg:flex-row gap-3 lg:gap-6">
            <InvoiceBlock v-if="data?.invoice" :invoice="data?.invoice" />

            <div class="flex flex-col shrink-0 gap-8 lg:gap-6 lg:w-72">
                <InvoiceDetailsBlock :invoice="data?.invoice" />
                <PaymentHistoryBlock
                    v-if="data?.paymentAttempts.data.length"
                    :payment-attempts="data?.paymentAttempts.data"
                    :customer="data.invoice.customer"
                />
                <CustomerBillingInformation
                    v-if="showCustomerBillingInformation"
                    :customer="data.invoice.customer"
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
</template>
