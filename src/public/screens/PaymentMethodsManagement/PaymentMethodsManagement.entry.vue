<script setup lang="ts">
import type { SolvimonPaymentMethodsManagementEntryProps } from './PaymentMethodsManagement.entry.types';
import PaymentMethodsManagement from './PaymentMethodsManagement.vue';
import PaymentMethodsManagementEntryView from './PaymentMethodsManagement.entry.view.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('payment-methods-management');

defineProps<SolvimonPaymentMethodsManagementEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <PaymentMethodsManagementEntryView v-bind="$props">
            <template
                #default="{
                    customer,
                    paymentMethods,
                    paymentMethodOptions,
                    isLoading,
                    refreshPaymentMethods,
                }"
            >
                <PaymentMethodsManagement
                    v-if="customer"
                    :is-loading="isLoading"
                    :payment-methods="paymentMethods"
                    :payment-method-options="paymentMethodOptions"
                    :customer="customer"
                    @set-default="refreshPaymentMethods"
                    @delete="refreshPaymentMethods"
                />
            </template>
        </PaymentMethodsManagementEntryView>
    </EntryProvider>
</template>
