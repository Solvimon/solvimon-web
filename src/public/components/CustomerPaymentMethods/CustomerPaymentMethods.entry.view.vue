<script setup lang="ts">
import { COMPONENT_NAME } from './CustomerPaymentMethods.entry.ce';
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { Provider } from '@/components/providers';

const DEFAULT_MAX_ITEMS = 3;

const props = defineProps<SolvimonCustomerPaymentMethodsEntryProps>();

const customerId = props.portalObject.customer_id;

const paymentMethods = usePaymentMethods({
    customerId,
    pageSize: props.configuration?.maxItems || DEFAULT_MAX_ITEMS,
});
const { isLoading } = useLoadInitialData(paymentMethods.fetchInitial());
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        :on-log="onLog"
        :css-overrides="cssOverrides"
        @error="(error) => $emit('error', error)"
    >
        <slot
            name="default"
            :payment-methods="paymentMethods.items.value"
            :is-loading="isLoading"
        />
    </Provider>
</template>
