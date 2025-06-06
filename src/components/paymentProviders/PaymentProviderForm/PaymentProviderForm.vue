<script setup lang="ts">
import type { PaymentMethodOptionResponseEntry } from '@solvimon/types';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { useData } from '@/utils/useData';
import PaymentProviderFormAdyen from '@/components/paymentProviders/PaymentProviderFormAdyen/PaymentProviderFormAdyen.vue';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';

const portal = usePortal();
const { getPaymentMethodOptions } = createPaymentMethodsService();

const { data: paymentMethodOptions, isPending } = useData({
    getData: async () => {
        return await getPaymentMethodOptions({ customerId: portal.value?.customer_id! });
    },
});

const isAdyenPaymentMethod = (paymentMethodOption: PaymentMethodOptionResponseEntry) =>
    !!paymentMethodOption.integration.payment_gateway?.adyen;
</script>

<template>
    <template v-if="!isPending">
        <template v-for="paymentMethodOption in paymentMethodOptions">
            <PaymentProviderFormAdyen
                v-if="isAdyenPaymentMethod(paymentMethodOption)"
                :key="`${paymentMethodOption.integration.id}-${paymentMethodOption.payment_acceptor.id}`"
                :payment-method-option="paymentMethodOption"
            />
        </template>
    </template>
</template>
