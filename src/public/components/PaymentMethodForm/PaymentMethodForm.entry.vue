<script setup lang="ts">
import { COMPONENT_NAME } from './PaymentMethodForm.entry.ce';
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';
import PaymentMethodFormEntryView from './PaymentMethodForm.entry.view.vue';
import PaymentMethodForm from './PaymentMethodForm.vue';
import { Provider } from '@/components/providers';

const props = defineProps<SolvimonPaymentMethodFormEntryProps>();
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
        @error="(error: Error) => $emit('error', error)"
    >
        <PaymentMethodFormEntryView v-bind="props">
            <template #default="{ customer, paymentMethodOptions, isLoading }">
                <PaymentMethodForm
                    v-if="customer"
                    :customer="customer"
                    :payment-method-options="paymentMethodOptions.paymentMethodOptions.value"
                    :configuration="configuration"
                    :is-loading="isLoading"
                />
            </template>
        </PaymentMethodFormEntryView>
    </Provider>
</template>
