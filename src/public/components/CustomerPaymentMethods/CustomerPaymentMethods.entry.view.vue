<script setup lang="ts">
import { COMPONENT_NAME } from './CustomerPaymentMethods.entry.ce';
import type { SolvimonCustomerPaymentMethodsEntryProps } from './CustomerPaymentMethods.entry.types';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { Provider } from '@/components/providers';

defineProps<SolvimonCustomerPaymentMethodsEntryProps>();

const portal = usePortal();

const customerId = portal.value?.customer_id;

const paymentMethods = usePaymentMethods({ customerId });
const customerPaymentMethodOptions = useCustomerPaymentMethodOptions({ customerId });

const { isLoading } = useLoadInitialData(
    paymentMethods.fetchAll(),
    customerPaymentMethodOptions.fetch(),
);
</script>

<template>
    <Provider
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :token="token || portal?.token"
        :locale="locale"
        :portal-object="portalObject"
        :allowed-portal-types="['CUSTOMER']"
        :primary-color="branding?.colors?.primary"
        :secondary-color="branding?.colors?.secondary"
        :experimental-features="experimentalFeatures"
        :log-level="logLevel"
        @error="(error) => $emit('error', error)"
    >
        <slot
            name="default"
            :payment-methods="paymentMethods.items.value"
            :payment-methods-options="customerPaymentMethodOptions.items.value"
            :is-loading="isLoading"
        />
    </Provider>
</template>
