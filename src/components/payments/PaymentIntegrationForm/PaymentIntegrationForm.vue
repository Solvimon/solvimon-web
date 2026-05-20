<script setup lang="ts">
import { ref } from 'vue';
import { FormMessage, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentGatewayVariant } from '@solvimon/solvimon-types';
import type {
    PaymentIntegrationFormEmits,
    PaymentIntegrationFormProps,
} from './PaymentIntegrationForm.types';
import PaymentIntegrationFormAdyen from '@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue';

const props = defineProps<PaymentIntegrationFormProps>();
const emit = defineEmits<PaymentIntegrationFormEmits>();
defineExpose({ submit });

const { $t } = useIntl();

const selectedIntegration = ref<PaymentGatewayVariant>();
const integrationRefs = ref(new Map());
const showIntegrationError = ref(false);

function handleSelect({
    paymentGatewayVariant,
    paymentMethodType,
}: {
    paymentGatewayVariant: PaymentGatewayVariant;
    paymentMethodType: string;
}) {
    showIntegrationError.value = false;
    emit('select', { paymentGatewayVariant, paymentMethodType });
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
            :ref="
                (el) =>
                    integrationRefs.set(
                        paymentMethodOption.integration.payment_gateway!.variant,
                        el,
                    )
            "
            :context="context"
            :payment-method-option-response-entry="paymentMethodOption"
            :country-code="countryCode"
            :customer-id="customerId"
            :variant="variant"
            :amount="amount"
            :invoice-id="invoiceId"
            :selected="
                selectedIntegration === paymentMethodOption.integration.payment_gateway.variant
            "
            :validate-on-submit="validateOnSubmit"
            :force-store-payment-method="forceStorePaymentMethod"
            @select="
                ({ paymentMethodType }) =>
                    handleSelect({
                        paymentGatewayVariant:
                            paymentMethodOption.integration.payment_gateway!.variant,
                        paymentMethodType,
                    })
            "
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
