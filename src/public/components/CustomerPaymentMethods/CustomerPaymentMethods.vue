<script setup lang="ts">
import type { CustomerPaymentMethodsProps } from './CustomerPaymentMethods.types';
import CustomerPaymentMethodsBlock from '@/components/customer/CustomerPaymentMethodsBlock/CustomerPaymentMethodsBlock.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useActionDispatchProvider } from '@/components/providers';

withDefaults(defineProps<CustomerPaymentMethodsProps>(), {
    configuration: () => ({
        showViewAllButton: true,
        showAddButton: true,
    }),
});

const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Skeleton v-if="isLoading" variant="section" class="h-72" />
    <CustomerPaymentMethodsBlock
        v-else
        :is-loading="isLoading"
        :payment-methods="paymentMethods"
        :payment-methods-options="paymentMethodsOptions"
        @view-all-payment-methods="dispatchAction({ action: 'view-all-payment-methods' })"
    />
</template>
