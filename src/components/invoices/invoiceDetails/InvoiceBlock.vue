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
        class="sv-invoice__summary grow"
        :title="
            $t({
                defaultMessage: 'Invoice',
                description: 'Title for the invoice block on the invoice details page',
                id: 'sdk.invoice_details.invoice.title',
            })
        "
    >
        <div class="sv-invoice__summary-body" :class="{ 'p-6 pt-2': !isSmallScreen }">
            <InfoBlock
                v-if="isSmallScreen"
                variant="default"
                has-icon
                class="sv-invoice__download-hint justify-center border-gray-100 bg-gray-50 font-semibold text-gray-800"
                >{{
                    $t({
                        defaultMessage: 'Download the PDF for a full breakdown',
                        description: 'Download the PDF for a full breakdown',
                        id: 'sdk.invoice_details.invoice.download_pdf',
                    })
                }}</InfoBlock
            >
            <InvoiceSummary
                class="sv-invoice__summary-content"
                :invoice="invoice"
                :is-expandable="!isSmallScreen"
            >
                <template #logo> <slot name="logo" /> </template
            ></InvoiceSummary>
            <InvoiceCreditsBreakdown class="sv-invoice__credits-breakdown" :invoice="invoice" />
        </div
    ></Section>
</template>
