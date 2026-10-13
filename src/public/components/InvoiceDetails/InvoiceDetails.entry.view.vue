<script setup lang="ts">
import { ErrorNotification, useIntl } from '@solvimon/solvimon-ui';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useInvoiceData } from '@/composables/useInvoiceData';

const props = defineProps<SolvimonInvoiceDetailsEntryProps>();

const { $t } = useIntl();

const invoiceData = useInvoiceData(props.configuration.invoiceId);
</script>

<template>
    <Skeleton
        v-if="invoiceData.isPending.value"
        variant="section"
        class="sv-invoice-details sv-root sv-component sv-loading min-h-[100px]"
        data-testid="invoice-details-skeleton"
    />
    <ErrorNotification
        v-else-if="!invoiceData.data.value"
        class="sv-invoice-details sv-root sv-component sv-error"
        :title="
            $t({
                defaultMessage: 'We could not load this invoice. Please try again.',
                description: 'Error shown in place of an invoice that failed to load',
                id: 'invoice.load_error',
            })
        "
    />
    <slot v-else name="default" :invoice="invoiceData.data.value.invoice" />
</template>
