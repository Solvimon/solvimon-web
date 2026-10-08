<script setup lang="ts">
import { getCustomerCountry } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { SolvimonPayInvoiceEntryProps } from './PayInvoice.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useInvoice } from '@/composables/useInvoice';
import { usePayments } from '@/composables/usePayments';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { getPaymentMethodOptionsForAcceptors } from '@/utils/paymentMethods';

const props = defineProps<SolvimonPayInvoiceEntryProps>();

const {
    invoice,
    get: getInvoice,
    downloadInvoicePdf,
    error,
} = useInvoice({ invoiceId: props.configuration.invoiceId });
const { payments, get: getPayments } = usePayments();
const { fetchInitial } = usePaymentMethods({
    customerId: props.portalObject.customer_id,
});
const { paymentMethodOptions, get: getPaymentMethodOptions } = usePaymentMethodOptions();

const getInvoiceAndPaymentMethodOptions = async () => {
    const invoice = await getInvoice();

    await getPaymentMethodOptions({
        customerId: invoice.customer.id,
        amount: invoice.open_invoice_amount,
    });
};

const { isLoading } = useLoadInitialData(
    getInvoiceAndPaymentMethodOptions(),
    fetchInitial(),
    getPayments(props.configuration.invoiceId),
);

const countryCode = computed(() =>
    invoice.value?.customer ? getCustomerCountry(invoice.value.customer) : undefined,
);

/**
 * The options are looked up for the customer, who may pay through acceptors this invoice does not
 * accept. Authorizing against one of those fails with a 400 nothing on the screen can recover
 * from, so only what the invoice takes is offered (DD-3533).
 */
const payableMethodOptions = computed(() =>
    getPaymentMethodOptionsForAcceptors(
        paymentMethodOptions.value ?? [],
        invoice.value?.payment_acceptor_ids,
    ),
);
</script>

<template>
    <slot
        name="default"
        :invoice="invoice"
        :is-loading="isLoading"
        :amount="invoice?.open_invoice_amount"
        :country-code="countryCode"
        :payment-method-options="payableMethodOptions"
        :payment-attempts="payments"
        :download-service="downloadInvoicePdf"
        :error="error"
    />
</template>
