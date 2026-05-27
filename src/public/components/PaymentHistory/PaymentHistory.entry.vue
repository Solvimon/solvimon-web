<script setup lang="ts">
import PaymentHistory from './PaymentHistory.vue';
import PaymentHistoryEntryView from './PaymentHistory.entry.view.vue';
import type { SolvimonPaymentHistoryEntryProps } from './PaymentHistory.entry.types';
import { COMPONENT_NAME } from './PaymentHistory.entry.ce';
import { Provider } from '@/components/providers';

const props = defineProps<SolvimonPaymentHistoryEntryProps>();

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
        :css-overrides="cssOverrides"
        @error="(error) => $emit('error', error)"
    >
        <PaymentHistoryEntryView v-bind="$props">
            <template #default="{ invoice, paymentAttempts, isLoading }">
                <PaymentHistory
                    v-if="invoice && paymentAttempts"
                    :is-loading="isLoading"
                    :customer="invoice.customer"
                    :payment-attempts="paymentAttempts"
                    :configuration="configuration"
                />
            </template>
        </PaymentHistoryEntryView>
    </Provider>
</template>
