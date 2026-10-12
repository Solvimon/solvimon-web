<script setup lang="ts">
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<SolvimonPaymentHistoryEntryProps>();

const { $t } = useIntl();

const invoiceData = useInvoiceData(props.configuration.invoiceId, { includePayments: true });
</script>

<template>
    <Skeleton
        v-if="invoiceData.isPending.value"
        variant="section"
        class="sv-payment-history sv-root sv-component sv-loading min-h-[100px]"
        data-testid="payment-history-skeleton"
    />
    <ErrorNotification
        v-else-if="!invoiceData.data.value"
        class="sv-payment-history sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'We could not load the payment history. Please try again.',
                description: 'Error shown in place of the payment history when it failed to load',
                id: 'payment_history.load_error',
            })
        "
    />
    <slot
        v-else
        name="default"
        :invoice="invoiceData.data.value.invoice"
        :payment-attempts="invoiceData.data.value.paymentAttempts?.data"
        :is-loading="invoiceData.isPending.value"
    />
</template>
