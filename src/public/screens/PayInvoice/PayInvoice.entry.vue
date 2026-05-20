<script setup lang="ts">
import type { SolvimonPayInvoiceEntryProps } from './PayInvoice.entry.types';
import { COMPONENT_NAME } from './PayInvoice.entry.ce';
import PayInvoice from './PayInvoice.vue';
import PayInvoiceEntryView from './PayInvoice.entry.view.vue';
import { Provider } from '@/components/providers';

defineProps<SolvimonPayInvoiceEntryProps>();
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
    </Provider>
</template>
