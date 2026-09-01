<script setup lang="ts">
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import CustomerPaymentMethods from './CustomerPaymentMethods.vue';
import CustomerPaymentMethodsView from './CustomerPaymentMethods.entry.view.vue';
import { EntryProvider } from '@/components/providers';
import { getComponentName } from '@/utils/component';

const componentName = getComponentName('customer-payment-methods');

defineProps<SolvimonCustomerPaymentMethodsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="componentName"
        :allowed-portal-types="['CUSTOMER']"
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
    </EntryProvider>
</template>
