<script setup lang="ts">
import type { SolvimonPaymentMethodsManagementEntryProps } from './PaymentMethodsManagement.entry.types';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethods } from '@/composables/usePaymentMethods';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLoadInitialData } from '@/composables/useLoadInitialData';

const props = defineProps<SolvimonPaymentMethodsManagementEntryProps>();

const customerId = props.portalObject.customer_id;

const { customer, get: fetchCustomer } = useCustomer({ customerId });

const { items: paymentMethods, fetchInitial } = usePaymentMethods({
    customerId: props.portalObject.customer_id,
});

const { paymentMethodOptions, get: fetchPaymentMethodOptions } = usePaymentMethodOptions();

const { isLoading } = useLoadInitialData(
    fetchCustomer.execute(),
    fetchInitial(),
    fetchPaymentMethodOptions({ customerId: props.portalObject.customer_id }),
);
</script>

<template>
    <slot
        name="default"
        :customer="customer"
        :payment-methods="paymentMethods"
        :payment-method-options="paymentMethodOptions"
        :is-loading="isLoading"
        :refresh-payment-methods="fetchInitial"
    />
</template>
