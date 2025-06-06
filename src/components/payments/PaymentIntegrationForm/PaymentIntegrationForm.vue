<script setup lang="ts">
import { ref } from 'vue';
import { FormMessage } from '@solvimon/ui';
import type {
    PaymentIntegrationFormEmits,
    PaymentIntegrationFormProps,
} from './PaymentIntegrationForm.types';
import PaymentIntegrationFormAdyen from '@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue';

const props = defineProps<PaymentIntegrationFormProps>();
defineEmits<PaymentIntegrationFormEmits>();
defineExpose({ submit });

const selectedIntegration = ref();
const integrationRefs = ref(new Map());
const showIntegrationError = ref(false);

function handleSelect(type: string) {
    selectedIntegration.value = type;
    showIntegrationError.value = false;
}

function submit() {
    if (!selectedIntegration.value) {
        showIntegrationError.value = true;
        void props.validateOnSubmit?.();
    }

    integrationRefs.value.get(selectedIntegration.value)?.submit();
}
</script>

<template>
    <template
        v-for="paymentMethodOption in paymentMethodOptions"
        :key="paymentMethodOption.integration.id"
    >
        <PaymentIntegrationFormAdyen
            v-if="paymentMethodOption.integration.payment_gateway?.variant === 'ADYEN'"
            :ref="(el) => integrationRefs.set('PAYMENT_GATEWAY_ADYEN', el)"
            :context="context"
            :payment-method-option-response-entry="paymentMethodOption"
            :country-code="countryCode"
            :customer-id="customerId"
            :variant="variant"
            :redirect-url="redirectUrl"
            :amount="amount"
            :invoice-id="invoiceId"
            :selected="selectedIntegration === 'PAYMENT_GATEWAY_ADYEN'"
            :validate-on-submit="validateOnSubmit"
            @select="() => handleSelect('PAYMENT_GATEWAY_ADYEN')"
            @error="(args) => $emit('error', args)"
            @payment-failed="(args) => $emit('payment-failed', args)"
            @payment-success="$emit('payment-success')"
        />
    </template>
    <FormMessage v-if="showIntegrationError" variant="error">Select a payment method</FormMessage>
</template>
