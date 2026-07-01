<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceEntryProps } from './Invoice.entry.types';
import InvoiceEntryView from './Invoice.entry.view.vue';
import { COMPONENT_NAME } from './Invoice.entry.ce';
import Invoice from './Invoice.vue';
import { Provider } from '@/components/providers';

const props = defineProps<SolvimonInvoiceEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}

const resolvedProps = computed<SolvimonInvoiceEntryProps>(() => ({
    ...props,
    configuration: {
        enableCustomerBillingInformation: true,
        enableDownloadButton: true,
        enablePaymentAttempts: true,
        ...props.configuration,
    },
}));
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        :css-overrides="cssOverrides"
        @error="(error) => $emit('error', error)"
    >
        <InvoiceEntryView v-bind="resolvedProps">
            <template #default="{ invoice, payments, isLoading, invoiceDownloadService }">
                <Invoice
                    v-if="invoice"
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :invoice-download-service="invoiceDownloadService"
                    :payments="payments.payments.value"
                    :configuration="resolvedProps.configuration"
                />
            </template>
        </InvoiceEntryView>
    </Provider>
</template>
