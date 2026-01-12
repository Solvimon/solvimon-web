<script setup lang="ts">
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import { COMPONENT_NAME } from './SolvimonAddPaymentMethodForm.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';

defineProps<Partial<SolvimonAddPaymentMethodFormProps>>();
</script>

<template>
    <Provider :token="token" :locale="locale" :custom-element-name="COMPONENT_NAME">
        <PaymentProviderForm v-if="token" :token="token" />
    </Provider>
</template>
