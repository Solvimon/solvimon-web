<script setup lang="ts">
import { ref } from 'vue';
import { FormMessage, useIntl } from '@solvimon/ui';
import type {
    PaymentIntegrationFormEmits,
    PaymentIntegrationFormProps,
} from './PaymentIntegrationForm.types';
import PaymentIntegrationFormAdyen from '@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue';

const props = defineProps<PaymentIntegrationFormProps>();
const emit = defineEmits<PaymentIntegrationFormEmits>();
defineExpose({ submit });

const { $t } = useIntl();

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

const handlePaymentSuccess = () => {
    if (props.successRedirectUrl) {
        window.location.href = props.successRedirectUrl;
    }

    emit('payment-success');
};
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
            :amount="amount"
            :invoice-id="invoiceId"
            :selected="selectedIntegration === 'PAYMENT_GATEWAY_ADYEN'"
            :validate-on-submit="validateOnSubmit"
            :force-store-payment-method="forceStorePaymentMethod"
            @select="() => handleSelect('PAYMENT_GATEWAY_ADYEN')"
            @payment-failed="(args) => $emit('payment-failed', args)"
            @payment-success="handlePaymentSuccess"
            @ready="emit('ready')"
        />
    </template>
    <FormMessage v-if="showIntegrationError" variant="error" class="mt-2">{{
        $t({
            defaultMessage: 'Select a payment method',
            id: 'payment_integration_form.select_payment_method_error',
            description: 'Error shown when no payment method is selected',
        })
    }}</FormMessage>
</template>
