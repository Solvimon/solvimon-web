<script setup lang="ts">
import type { PaymentProviderFormProps } from './PaymentProviderForm.types';
import { getPaymentMethodOptions } from '@/services/paymentMethod';
import { useData } from '@/utils/useData';
import type { PaymentMethodOption } from '@solvimon/types';
import PaymentProviderFormAdyen from '../PaymentProviderFormAdyen/PaymentProviderFormAdyen.vue';
import { usePortal } from '@/components/PortalProvider/composables/usePortal';

defineProps<PaymentProviderFormProps>();

const portal = usePortal();

const { data: paymentMethodOptions, isPending } = useData(() => getPaymentMethodOptions({ customerId: portal.value?.customer_id! }));

const isAdyenPaymentMethod = (paymentMethodOption: PaymentMethodOption) => !!paymentMethodOption.integration.payment_gateway?.adyen

</script>

<template>
    <template v-if="!isPending" v-for="paymentMethodOption in paymentMethodOptions">
        <PaymentProviderFormAdyen v-if="isAdyenPaymentMethod(paymentMethodOption)" :payment-method-option="paymentMethodOption" />
    </template>
</template>