<script setup lang="ts">
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import CustomerPaymentMethods from './CustomerPaymentMethods.vue';
import CustomerPaymentMethodsView from './CustomerPaymentMethods.entry.view.vue';

defineProps<Partial<SolvimonCustomerPaymentMethodsEntryProps>>();
</script>

<template>
    <CustomerPaymentMethodsView>
        <template #default="{ paymentMethods, paymentMethodsOptions, isLoading }">
            <CustomerPaymentMethods
                :configuration="configuration"
                :payment-methods="paymentMethods"
                :payment-methods-options="paymentMethodsOptions"
                :is-loading="isLoading"
            />
        </template>
    </CustomerPaymentMethodsView>
</template>
