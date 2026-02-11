<script setup lang="ts">
import type {
    SolvimonCustomerSubscriptionBlockEmits,
    SolvimonCustomerSubscriptionBlockProps,
} from './SolvimonCustomerSubscriptionBlock.types';
import { COMPONENT_NAME } from './SolvimonCustomerSubscriptionBlock.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import CustomerSubscriptionBlock from '@/components/customer/CustomerSubscriptionBlock/CustomerSubscriptionBlock.vue';

const props = defineProps<Partial<SolvimonCustomerSubscriptionBlockProps>>();
defineEmits<SolvimonCustomerSubscriptionBlockEmits>();

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
        <CustomerSubscriptionBlock
            :hide-cta-buttons="hideCtaButtons"
            @view-all="(routeName: string) => $emit('view-all', routeName)"
            @view-details="$emit('view-details', $event)"
            @cancel-subscription="$emit('cancel-subscription', $event)"
            @renew-subscription="$emit('renew-subscription', $event)"
        />
    </Provider>
</template>
