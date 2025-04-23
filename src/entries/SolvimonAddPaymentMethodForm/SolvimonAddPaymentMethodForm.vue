<script setup lang="ts">
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import Provider from '@/components/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';

const props = defineProps<SolvimonAddPaymentMethodFormProps>();

if (!props.token) {
    // eslint-disable-next-line no-console
    console.error('SolvimonAddPaymentMethodForm: token is required');
}
if (!props.environment) {
    // eslint-disable-next-line no-console
    console.error('SolvimonAddPaymentMethodForm: environment is required');
}
</script>

<template>
    <Provider v-if="environment && token" :environment="environment" :token="token" locale="en">
        <PaymentProviderForm :token="token" />
    </Provider>
</template>
