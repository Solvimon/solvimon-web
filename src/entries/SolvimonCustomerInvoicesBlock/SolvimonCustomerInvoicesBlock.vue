<script setup lang="ts">
import type {
    SolvimonCustomerInvoicesBlockEmits,
    SolvimonCustomerInvoicesBlockProps,
} from './SolvimonCustomerInvoicesBlock.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import CustomerInvoicesBlock from '@/components/customer/CustomerInvoicesBlock/CustomerInvoicesBlock.vue';

const props = defineProps<Partial<SolvimonCustomerInvoicesBlockProps>>();
defineEmits<SolvimonCustomerInvoicesBlockEmits>();

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
        <CustomerInvoicesBlock
            :portal-url="props.portalUrl"
            @view-all="(routeName) => $emit('view-all', routeName)"
            @view-invoice="$emit('view-invoice', $event)"
            @pay-invoice="$emit('pay-invoice', $event)"
        />
    </Provider>
</template>
