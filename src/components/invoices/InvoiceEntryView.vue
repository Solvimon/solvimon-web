<script setup lang="ts">
import type { Invoice } from '@solvimon/solvimon-types';
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useInvoice } from '@/composables/useInvoice';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePayments } from '@/composables/usePayments';

const props = defineProps<{ invoiceId: Invoice['id'] }>();

const { $t } = useIntl();

const invoice = useInvoice({ invoiceId: props.invoiceId });
const payments = usePayments();

const { isLoading } = useLoadInitialData(invoice.get(), payments.get(props.invoiceId));
</script>

<template>
    <Skeleton
        v-if="isLoading || invoice.isPending.value"
        variant="section"
        class="sv-root sv-component sv-loading min-h-[100px]"
        data-testid="invoice-skeleton"
    />
    <ErrorNotification
        v-else-if="!invoice.invoice.value"
        class="sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'We could not load this invoice. Please try again.',
                description: 'Error shown in place of an invoice that failed to load',
                id: 'invoice.load_error',
            })
        "
    />
    <slot
        v-else
        name="default"
        :invoice="invoice.invoice.value"
        :invoice-download-service="invoice.downloadInvoicePdf"
        :payments="payments"
    />
</template>
