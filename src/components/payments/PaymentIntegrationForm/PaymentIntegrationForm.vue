<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
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
import type { Error as PaymentError } from '@/types/errors';

const PaymentIntegrationFormStripe = defineAsyncComponent(() =>
    import('@/components/payments/PaymentIntegrationFormStripe/PaymentIntegrationFormStripe.vue').then(
        (m) => m.default,
    ),
);
const PaymentIntegrationFormAdyen = defineAsyncComponent(() =>
    import('@/components/payments/PaymentIntegrationFormAdyen/PaymentIntegrationFormAdyen.vue').then(
        (m) => m.default,
    ),
);

const props = withDefaults(defineProps<PaymentIntegrationFormProps>(), {
    storePaymentMethod: undefined,
});
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

/**
 * The form a payment is on its way through. A form can take a payment without the screen, from
 * Enter in its card fields or its own wallet button, and the screen lets go of the forms while one
 * waits on the customer, so every other form is held off here until that payment is over.
 */
let formInFlight: string | undefined;
const validators = new Map<string, () => Promise<boolean>>();

function validateFor(formId: string): () => Promise<boolean> {
    let validate = validators.get(formId);
    if (!validate) {
        validate = () =>
            formInFlight !== undefined && formInFlight !== formId
                ? Promise.resolve(false)
                : (props.validateOnSubmit?.() ?? Promise.resolve(true));
        validators.set(formId, validate);
    }
    return validate;
}

function settle(formId: string) {
    if (formInFlight === formId) formInFlight = undefined;
}

const handleSubmitting = (formId: string) => {
    formInFlight = formId;
    emit('submitting');
};

const handlePaymentFailed = (formId: string, error: PaymentError) => {
    settle(formId);
    emit('payment-failed', error);
};

const handlePaymentSuccess = (formId: string) => {
    settle(formId);
    emit('payment-success');
};

const handleInvalid = (formId: string, reason?: 'NO_PAYMENT_METHOD') => {
    // Held off while another form's payment is on its way: the screen is still waiting on that one.
    if (formInFlight !== undefined && formInFlight !== formId) return;

    settle(formId);

    if (reason === 'NO_PAYMENT_METHOD') {
        showIntegrationError.value = true;
    }

    emit('invalid', reason);
};

function submit() {
    if (!selectedIntegration.value) {
        showIntegrationError.value = true;
        void props.validateOnSubmit?.();
        emit('invalid');
        return;
    }

    const integration = integrationRefs.value.get(selectedIntegration.value);

    if (!integration) {
        emit('invalid');
        return;
    }

    integration.submit();
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
            :validate-on-submit="validateFor(paymentMethodOption.integration.id)"
            :force-store-payment-method="forceStorePaymentMethod"
            :store-payment-method="storePaymentMethod"
            :redirects-on-success="redirectsOnSuccess"
            :billing-entity-name="billingEntityName"
            @select="handleSelect"
            @payment-failed="handlePaymentFailed(paymentMethodOption.integration.id, $event)"
            @payment-success="handlePaymentSuccess(paymentMethodOption.integration.id)"
            @invalid="(reason) => handleInvalid(paymentMethodOption.integration.id, reason)"
            @submitting="handleSubmitting(paymentMethodOption.integration.id)"
            @action-required="$emit('action-required')"
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
            :validate-on-submit="validateFor(paymentMethodOption.integration.id)"
            :force-store-payment-method="forceStorePaymentMethod"
            :store-payment-method="storePaymentMethod"
            :redirects-on-success="redirectsOnSuccess"
            :billing-entity-name="billingEntityName"
            @select="handleSelect"
            @payment-failed="handlePaymentFailed(paymentMethodOption.integration.id, $event)"
            @payment-success="handlePaymentSuccess(paymentMethodOption.integration.id)"
            @invalid="handleInvalid(paymentMethodOption.integration.id)"
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
