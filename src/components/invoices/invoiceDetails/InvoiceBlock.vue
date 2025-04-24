<script setup lang="ts">
import { InvoiceSummary, InfoBlock, useIntl, Section } from '@solvimon/ui';
import { computed } from 'vue';
import { useWindowSize } from '@vueuse/core';
import type { Invoice } from '@solvimon/types';

defineProps<{
    invoice: Invoice;
}>();
const { $t } = useIntl();

const { width } = useWindowSize();
const isSmallScreen = computed(() => width.value <= 768);
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
                class="justify-center bg-gray-50 border-gray-100 text-gray-800 font-semibold"
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
            ></InvoiceSummary></div
    ></Section>
</template>
