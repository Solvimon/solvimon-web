<script setup lang="ts">
import { getCustomerCountry } from '@solvimon/solvimon-ui';
import type { SolvimonPaymentMethodFormEntryProps } from './PaymentMethodForm.entry.types';
import { useLoadInitialData } from '@/composables/useLoadInitialData';
import { useCustomer } from '@/composables/useCustomer';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';

const props = defineProps<SolvimonPaymentMethodFormEntryProps>();

const customer = useCustomer({ customerId: props.portalObject.customer_id });
const paymentMethodOptions = usePaymentMethodOptions();

const initialLoad = async (): Promise<void> => {
    const customerResponse = await customer.get.execute();
    const country = getCustomerCountry(customerResponse);

    await paymentMethodOptions.get({
        customerId: customerResponse.id,
        country,
        amount: props.configuration?.amount,
    });
};

const { isLoading } = useLoadInitialData(initialLoad());
</script>

<template>
    <slot
        name="default"
        :customer="customer.customer.value"
        :payment-method-options="paymentMethodOptions"
        :is-loading="isLoading"
    />
</template>
