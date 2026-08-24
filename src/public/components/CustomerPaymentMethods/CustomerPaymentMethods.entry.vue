<script setup lang="ts">
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import CustomerPaymentMethods from './CustomerPaymentMethods.vue';
import CustomerPaymentMethodsView from './CustomerPaymentMethods.entry.view.vue';
import { COMPONENT_NAME } from './CustomerPaymentMethods.entry.ce';
import { EntryProvider } from '@/components/providers';

defineProps<SolvimonCustomerPaymentMethodsEntryProps>();
</script>

<template>
    <EntryProvider
        :entry="$props"
        :component-name="COMPONENT_NAME"
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
