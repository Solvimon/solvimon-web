<script setup lang="ts">
import type { SolvimonPaymentMethodsManagementEntryProps } from './PaymentMethodsManagement.entry.types';
import { COMPONENT_NAME } from './PaymentMethodsManagement.entry.ce';
import PaymentMethodsManagement from './PaymentMethodsManagement.vue';
import PaymentMethodsManagementEntryView from './PaymentMethodsManagement.entry.view.vue';
import { Provider } from '@/components/providers';

defineProps<SolvimonPaymentMethodsManagementEntryProps>();
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
        <PaymentMethodsManagementEntryView v-bind="$props">
            <template #default="{ customer, paymentMethods, paymentMethodOptions, isLoading, refreshPaymentMethods }">
                <PaymentMethodsManagement
                    v-if="customer"
                    :is-loading="isLoading"
                    :payment-methods="paymentMethods"
                    :payment-method-options="paymentMethodOptions"
                    :customer="customer"
                    @set-default="refreshPaymentMethods"
                />
            </template>
        </PaymentMethodsManagementEntryView>
    </Provider>
</template>
