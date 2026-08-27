<script setup lang="ts">
import { computed } from 'vue';
import type { CustomerPaymentMethodsProps } from './CustomerPaymentMethods.types';
import CustomerPaymentMethodsBlock from '@/components/customer/CustomerPaymentMethodsBlock/CustomerPaymentMethodsBlock.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import { useActionDispatchProvider } from '@/components/providers';
import { resolveConfiguration } from '@/utils/configuration';

/** Only the options this component reads — the item limit is resolved where the methods are fetched. */
const DEFAULT_CONFIGURATION = {
    showViewAllButton: true,
    showAddButton: true,
};

const props = defineProps<CustomerPaymentMethodsProps>();

const configuration = computed(() =>
    resolveConfiguration(DEFAULT_CONFIGURATION, props.configuration),
);

const { dispatchAction } = useActionDispatchProvider();
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-methods sv-root sv-component sv-loading h-72"
        data-testid="customer-payment-methods-skeleton"
    />
    <CustomerPaymentMethodsBlock
        v-else
        class="sv-payment-methods sv-root sv-component"
        :is-loading="isLoading"
        :payment-methods="paymentMethods"
        :show-view-all-button="configuration.showViewAllButton"
        :show-add-button="configuration.showAddButton"
        @view-all-payment-methods="dispatchAction({ action: 'view-all-payment-methods' })"
        @add-payment-method="dispatchAction({ action: 'add-payment-method' })"
    />
</template>
