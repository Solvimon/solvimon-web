<script setup lang="ts">
import { computed } from 'vue';
import type { SolvimonInvoiceHeaderEntryProps } from './InvoiceHeader.entry.types';
import InvoiceHeaderEntryView from './InvoiceHeader.entry.view.vue';
import InvoiceHeader from './InvoiceHeader.vue';
import { Provider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const COMPONENT_NAME = getComponentName('invoice-header');

const props = defineProps<SolvimonInvoiceHeaderEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}

const resolvedProps = computed<SolvimonInvoiceHeaderEntryProps>(() => ({
    ...props,
    configuration: {
        enableDownloadButton: true,
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
        <InvoiceHeaderEntryView v-bind="resolvedProps">
            <template #default="{ invoice, payments, isLoading, invoiceDownloadService }">
                <InvoiceHeader
                    v-if="invoice"
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :invoice-download-service="invoiceDownloadService"
                    :payments="payments.payments.value"
                    :configuration="resolvedProps.configuration"
                />
            </template>
        </InvoiceHeaderEntryView>
    </Provider>
</template>
