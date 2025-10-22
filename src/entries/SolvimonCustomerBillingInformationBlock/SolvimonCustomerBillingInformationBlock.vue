<script setup lang="ts">
import type {
    SolvimonCustomerBillingInformationBlockEmits,
    SolvimonCustomerBillingInformationBlockProps,
} from './SolvimonCustomerBillingInformationBlock.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import CustomerBillingInformationBlock from '@/components/customer/CustomerBillingInformationBlock/CustomerBillingInformationBlock.vue';

const props = defineProps<Partial<SolvimonCustomerBillingInformationBlockProps>>();
const emit = defineEmits<SolvimonCustomerBillingInformationBlockEmits>();

if (!props.environment) {
    throw new Error('environment props are required');
}

if (!props.token) {
    throw new Error('token prop is required');
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
        <CustomerBillingInformationBlock
            @edit-billing-information="(routeName) => emit('edit-billing-information', routeName)"
        />
    </Provider>
</template>
