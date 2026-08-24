<script setup lang="ts">
import type { SolvimonPayInvoiceEntryProps } from './PayInvoice.entry.types';
import { COMPONENT_NAME } from './PayInvoice.entry.ce';
import PayInvoice from './PayInvoice.vue';
import PayInvoiceEntryView from './PayInvoice.entry.view.vue';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonPayInvoiceEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <PayInvoiceEntryView v-bind="$props">
            <template
                #default="{
                    invoice,
                    isLoading,
                    amount,
                    countryCode,
                    paymentMethodOptions,
                    paymentAttempts,
                    downloadService,
                }"
            >
                <PayInvoice
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :amount="amount"
                    :country-code="countryCode"
                    :payment-method-options="paymentMethodOptions"
                    :configuration="configuration"
                    :payment-attempts="paymentAttempts ?? []"
                    :download-service="downloadService"
                />
            </template>
        </PayInvoiceEntryView>
    </EntryProvider>
</template>
