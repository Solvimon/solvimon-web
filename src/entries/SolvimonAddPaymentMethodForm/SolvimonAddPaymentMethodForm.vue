<script setup lang="ts">
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import Provider from '@/components/providers/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';

defineProps<SolvimonAddPaymentMethodFormProps>();
</script>

<template>
    <Provider :token="token" :locale="locale">
        <PaymentProviderForm v-if="token" :token="token" />
    </Provider>
</template>
