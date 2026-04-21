<script setup lang="ts">
import type { SolvimonAddPaymentMethodFormProps } from './SolvimonAddPaymentMethodForm.types';
import { COMPONENT_NAME } from './SolvimonAddPaymentMethodForm.ce';
import Provider from '@/components/providers/Provider/Provider.vue';
import PaymentProviderForm from '@/components/paymentProviders/PaymentProviderForm/PaymentProviderForm.vue';

defineProps<SolvimonAddPaymentMethodFormProps>();
</script>

<template>
    <Provider
        :locale="locale"
        :custom-element-name="COMPONENT_NAME"
        :environment="environment"
        :portal-object="portalObject"
        :log-level="logLevel"
        :on-log="onLog"
    >
        <PaymentProviderForm :token="portalObject.token" />
    </Provider>
</template>
