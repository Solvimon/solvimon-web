<script setup lang="ts">
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import Provider from '@/components/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';

defineProps<SolvimonAddPaymentMethodFormProps>();
</script>

<template>
    <Provider :environment="environment" :token="token" locale="en">
        <PaymentProviderForm :token="token" />
    </Provider>
</template>
