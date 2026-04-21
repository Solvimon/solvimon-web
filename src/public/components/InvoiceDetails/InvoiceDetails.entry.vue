<script setup lang="ts">
import InvoiceDetails from './InvoiceDetails.vue';
import InvoiceDetailsEntryView from './InvoiceDetails.entry.view.vue';
import type { SolvimonInvoiceDetailsEntryProps } from './InvoiceDetails.entry.types';
import { COMPONENT_NAME } from './InvoiceDetails.entry.ce';
import { Provider } from '@/components/providers';

const props = defineProps<SolvimonInvoiceDetailsEntryProps>();

if (!props.configuration?.invoiceId) {
    throw new Error('Missing invoice id');
}
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
        @error="(error) => $emit('error', error)"
    >
        <InvoiceDetailsEntryView v-bind="$props">
            <template #default="{ invoice, isLoading }">
                <InvoiceDetails
                    v-if="invoice"
                    :is-loading="isLoading"
                    :invoice="invoice"
                    :configuration="configuration"
                />
            </template>
        </InvoiceDetailsEntryView>
    </Provider>
</template>
