<script setup lang="ts">
import type {
    SolvimonCustomerPaymentMethodsBlockEmits,
    SolvimonCustomerPaymentMethodsBlockProps,
} from './SolvimonCustomerPaymentMethodsBlock.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import CustomerPaymentMethodsBlock from '@/components/customer/CustomerPaymentMethodsBlock/CustomerPaymentMethodsBlock.vue';

const props = defineProps<Partial<SolvimonCustomerPaymentMethodsBlockProps>>();
defineEmits<SolvimonCustomerPaymentMethodsBlockEmits>();

if (!props.environment) {
    throw new Error('environment props are required');
}

if (!props.token) {
    throw new Error('token prop is required');
}

if (!props.portalUrl) {
    throw new Error('portalUrl prop is required');
}
</script>

<template>
    <Provider
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-url-types="['CUSTOMER']"
        @error="(error) => $emit('error', error)"
    >
        <CustomerPaymentMethodsBlock
            :portal-url="props.portalUrl"
            @payment-method-updated="() => $emit('payment-method-updated')"
            @view-all="(routeName) => $emit('view-all', routeName)"
            @add-payment-method="(routeName) => $emit('add-payment-method', routeName)"
        />
    </Provider>
</template>
