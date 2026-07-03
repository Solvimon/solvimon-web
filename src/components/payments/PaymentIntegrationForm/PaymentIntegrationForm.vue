<script setup lang="ts">
import { computed, ref } from 'vue';
import { FormMessage, useIntl } from '@solvimon/solvimon-ui';
import type {
    PaymentGatewayVariant,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/solvimon-types';
import type {
    PaymentIntegrationFormEmits,
    PaymentIntegrationFormProps,
} from './PaymentIntegrationForm.types';
import {
    isAdyenPaymentIntegration,
    isSelectedIntegration,
    isStripePaymentIntegration,
} from './PaymentIntegrationForm.lib';
import PaymentIntegrationFormStripe from '@/components/payments/PaymentIntegrationFormStripe/PaymentIntegrationFormStripe.vue';
import PaymentIntegrationFormAdyen from '@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue';

const props = defineProps<PaymentIntegrationFormProps>();
const emit = defineEmits<PaymentIntegrationFormEmits>();
defineExpose({ submit });

const { $t } = useIntl();

const userSelectedIntegration = ref<PaymentGatewayVariant>();
const selectedIntegration = computed(
    () =>
        userSelectedIntegration.value ??
        props.paymentMethodOptions[0]?.integration.payment_gateway?.variant,
);

const integrationRefs = ref(new Map());
const showIntegrationError = ref(false);

const handleSelect = ({
    paymentGatewayVariant,
    paymentMethodType,
}: {
    paymentGatewayVariant: PaymentGatewayVariant;
    paymentMethodType: string;
}) => {
    showIntegrationError.value = false;
    userSelectedIntegration.value = paymentGatewayVariant;
    emit('select', { paymentGatewayVariant, paymentMethodType });
};

const setIntegrationRef = (paymentMethodOption: PaymentMethodOptionResponseEntry) => {
    return (el: unknown) =>
        integrationRefs.value.set(paymentMethodOption.integration.payment_gateway?.variant, el);
};

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
        <!-- Adyen -->
        <PaymentIntegrationFormAdyen
            v-if="isAdyenPaymentIntegration(paymentMethodOption)"
            :ref="setIntegrationRef(paymentMethodOption)"
            :context="context"
            :payment-method-option-response-entry="paymentMethodOption"
            :country-code="countryCode"
            :customer-id="customerId"
            :variant="variant"
            :amount="amount"
            :invoice-id="invoiceId"
            :selected="isSelectedIntegration({ selectedIntegration, paymentMethodOption })"
            :validate-on-submit="validateOnSubmit"
            :force-store-payment-method="forceStorePaymentMethod"
            @select="handleSelect"
            @payment-failed="$emit('payment-failed', $event)"
            @payment-success="$emit('payment-success')"
            @ready="$emit('ready')"
        />

        <!-- Stripe -->
        <PaymentIntegrationFormStripe
            v-else-if="isStripePaymentIntegration(paymentMethodOption)"
            :ref="setIntegrationRef(paymentMethodOption)"
            :context="context"
            :payment-method-option-response-entry="paymentMethodOption"
            :country-code="countryCode"
            :customer-id="customerId"
            :variant="variant"
            :amount="amount"
            :invoice-id="invoiceId"
            :selected="isSelectedIntegration({ selectedIntegration, paymentMethodOption })"
            :email="email"
            :name="name"
            :validate-on-submit="validateOnSubmit"
            :force-store-payment-method="forceStorePaymentMethod"
            @select="handleSelect"
            @payment-failed="$emit('payment-failed', $event)"
            @payment-success="$emit('payment-success')"
            @ready="$emit('ready')"
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
