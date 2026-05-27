<script setup lang="ts">
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import CustomerPaymentMethods from './CustomerPaymentMethods.vue';
import CustomerPaymentMethodsView from './CustomerPaymentMethods.entry.view.vue';
import { COMPONENT_NAME } from './CustomerPaymentMethods.entry.ce';
import { Provider } from '@/components/providers';

defineProps<SolvimonCustomerPaymentMethodsEntryProps>();
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
        <CustomerPaymentMethodsView v-bind="$props">
            <template #default="{ paymentMethods, isLoading }">
                <CustomerPaymentMethods
                    :configuration="configuration"
                    :payment-methods="paymentMethods"
                    :is-loading="isLoading"
                />
            </template>
        </CustomerPaymentMethodsView>
    </Provider>
</template>
