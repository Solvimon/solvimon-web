<script setup lang="ts">
import type {
    SolvimonCustomerInvoicesBlockEmits,
    SolvimonCustomerInvoicesBlockProps,
} from './SolvimonCustomerInvoicesBlock.types';
import { COMPONENT_NAME } from './SolvimonCustomerInvoicesBlock.ce';
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
        <CustomerInvoicesBlock
            @view-all="(routeName) => $emit('view-all', routeName)"
            @view-invoice="$emit('view-invoice', $event)"
            @pay-invoice="$emit('pay-invoice', $event)"
        />
    </Provider>
</template>
