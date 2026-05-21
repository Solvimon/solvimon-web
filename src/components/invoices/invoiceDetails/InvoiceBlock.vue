<script setup lang="ts">
import { InvoiceSummary, InfoBlock, useIntl, Section } from '@solvimon/solvimon-ui';
import type { Invoice } from '@solvimon/solvimon-types';
import InvoiceCreditsBreakdown from './InvoiceCreditsBreakdown.vue';
import { useViewport } from '@/composables/useViewport';

defineProps<{
    invoice: Invoice;
}>();

const { $t } = useIntl();

const { isMobileViewport: isSmallScreen } = useViewport();
</script>

<template>
    <Section
        :title="
            $t({
                defaultMessage: 'Invoice',
                description: 'Title for the invoice block on the invoice details page',
                id: 'sdk.invoice_details.invoice.title',
            })
        "
        class="grow"
    >
        <div :class="{ 'p-6 pt-2': !isSmallScreen }">
            <InfoBlock
                v-if="isSmallScreen"
                variant="default"
                has-icon
                class="justify-center border-gray-100 bg-gray-50 font-semibold text-gray-800"
                >{{
                    $t({
                        defaultMessage: 'Download the PDF for a full breakdown',
                        description: 'Download the PDF for a full breakdown',
                        id: 'sdk.invoice_details.invoice.download_pdf',
                    })
                }}</InfoBlock
            >
            <InvoiceSummary :invoice="invoice" :is-expandable="!isSmallScreen">
                <template #logo> <slot name="logo" /> </template
            ></InvoiceSummary>
            <InvoiceCreditsBreakdown :invoice="invoice" /></div
    ></Section>
</template>
