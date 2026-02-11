<script setup lang="ts">
import type {
    SolvimonCustomerPaymentMethodsBlockEmits,
    SolvimonCustomerPaymentMethodsBlockProps,
} from './SolvimonCustomerPaymentMethodsBlock.types';
import { COMPONENT_NAME } from './SolvimonCustomerPaymentMethodsBlock.ce';
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
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token"
        :locale="locale"
        :allowed-portal-types="['CUSTOMER']"
        :portal-object="portalObject"
        @error="(error) => $emit('error', error)"
    >
        <CustomerPaymentMethodsBlock
            @payment-method-updated="() => $emit('payment-method-updated')"
            @view-all="(routeName) => $emit('view-all', routeName)"
            @add-payment-method="(routeName) => $emit('add-payment-method', routeName)"
        />
    </Provider>
</template>
