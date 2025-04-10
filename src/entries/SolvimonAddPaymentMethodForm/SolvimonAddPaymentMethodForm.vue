<script setup lang="ts">
import { Icon } from '@solvimon/ui';
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import Provider from '@/components/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';
import Invoice from '@/components/Invoice/Invoice.vue';

defineProps<SolvimonAddPaymentMethodFormProps>();
</script>

<template>
    <Provider :environment="environment" :token="token" locale="en">
        <Invoice />
        <PaymentProviderForm :token="token" />
    </Provider>
</template>
