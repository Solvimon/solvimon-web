<script setup lang="ts">
import {
    Button,
    getCustomerCountry,
    getCustomerName,
    Section,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref } from 'vue';
import type { Amount } from '@solvimon/solvimon-types';
import type {
    PaymentMethodFormConfiguration,
    PaymentMethodFormEmits,
    PaymentMethodFormProps,
} from './PaymentMethodForm.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import PaymentMethodsUnavailableCard from '@/components/payments/PaymentMethodsUnavailableCard/PaymentMethodsUnavailableCard.vue';
import { usePaymentMethodAvailability } from '@/composables/usePaymentMethodAvailability';
import type {
    AuthorizePaymentIntegrationFormProps,
    PaymentIntegrationFormProps,
    TokenizePaymentIntegrationFormProps,
    SelectedPaymentMethod,
} from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

const FALLBACK_COUNTRY_CODE = 'NL';
const DEFAULT_AMOUNT: Amount = {
    currency: 'EUR',
    quantity: '0',
};

const props = withDefaults(defineProps<PaymentMethodFormProps>(), {
    isLoading: false,
});

const emit = defineEmits<PaymentMethodFormEmits>();

const { $t } = useIntl();

const { availability } = usePaymentMethodAvailability({
    paymentMethodOptions: () => props.paymentMethodOptions,
    isLoading: () => props.isLoading,
    context: () => ({ invoiceId: props.configuration?.invoiceId }),
});

const paymentIntegrationFormRef = ref<InstanceType<typeof PaymentIntegrationForm>>();
const selectedPaymentMethod = ref<SelectedPaymentMethod>();
const isPaymentPending = ref(false);
/**
 * A stored method is the end of the road for this form: the gateway has torn its drop-in down, so a
 * second submit reaches nothing and no result ever comes back to clear the pending state. The host
 * redirects away on success, but that takes a moment, and the form stays shut for it.
 */
const isPaymentCompleted = ref(false);
const isFormLocked = computed(() => isPaymentPending.value || isPaymentCompleted.value);

function handleSubmit() {
    if (isFormLocked.value) {
        return;
    }

    isPaymentPending.value = true;
    paymentIntegrationFormRef.value?.submit();
}

const submitLabel = computed(() =>
    $t({
        defaultMessage: 'Save payment method',
        description: 'Label of the button that stores the entered payment method',
        id: 'components.payment_method_form.submit_button.label',
    }),
);

// Lets a host submit the form from its own chrome, and mirror the pending state onto its button.
defineExpose({ submit: handleSubmit, isPaymentPending });

function handlePaymentSuccess() {
    isPaymentPending.value = false;
    isPaymentCompleted.value = true;
    emit('success');
}

function handlePaymentFailed(error: unknown) {
    isPaymentPending.value = false;
    emit('failure', error);
}

const resolveConfiguration = (
    configuration?: PaymentMethodFormConfiguration,
): PaymentMethodFormConfiguration => {
    if (configuration?.variant === 'AUTHORIZE') {
        return configuration;
    }

    return {
        ...configuration,
        variant: 'TOKENIZE',
    };
};

const configuration = computed<PaymentMethodFormConfiguration>(() =>
    resolveConfiguration(props.configuration),
);

const countryCode = computed<string>(() => {
    let result = FALLBACK_COUNTRY_CODE;

    if (props.countryCode) {
        result = props.countryCode;
        return result;
    }

    if (props.customer) {
        const country = getCustomerCountry(props.customer);
        if (country) {
            result = country;
            return result;
        }
    }

    return FALLBACK_COUNTRY_CODE;
});

const paymentIntegrationProps = computed<PaymentIntegrationFormProps>(() => {
    const variant = configuration.value.variant;
    const customerName = getCustomerName(props.customer);

    const commonProps = {
        amount: configuration.value.amount ?? DEFAULT_AMOUNT,
        paymentMethodOptions: props.paymentMethodOptions,
        countryCode: countryCode.value,
        ...(props.customer.email ? { email: props.customer.email } : {}),
        ...(customerName ? { name: customerName } : {}),
        validateOnSubmit: configuration.value.validateOnSubmit,
        forceStorePaymentMethod: configuration.value.forceStorePaymentMethod,
        selectedOption: configuration.value.selectedOption,
        invoiceId: configuration.value.invoiceId,
    };

    if (variant === 'AUTHORIZE') {
        return {
            ...commonProps,
            variant,
            context: configuration.value.context,
        } satisfies AuthorizePaymentIntegrationFormProps;
    }

    return {
        ...commonProps,
        variant: 'TOKENIZE',
        customerId: props.customer.id,
    } satisfies TokenizePaymentIntegrationFormProps;
});
</script>

<template>
    <Skeleton
        v-if="isLoading"
        variant="section"
        class="sv-payment-method-form sv-root sv-component sv-loading min-h-[180px]"
        data-testid="payment-method-form-skeleton"
    />
    <PaymentMethodsUnavailableCard
        v-else-if="availability === 'UNAVAILABLE'"
        class="sv-payment-method-form sv-root sv-component"
        :variant="configuration.variant ?? 'TOKENIZE'"
    />
    <Section
        v-else
        class="sv-payment-method-form sv-root sv-component"
        no-border
        no-spacing
        content-background="none"
        :title="
            title ??
            $t({
                defaultMessage: 'Available payment methods',
                description: 'Title of the available payment methods form',
                id: 'components.payment_method_form.section_title',
            })
        "
    >
        <div :class="{ 'pointer-events-none opacity-60': isFormLocked }">
            <PaymentIntegrationForm
                ref="paymentIntegrationFormRef"
                class="sv-payment-method-form__integration"
                v-bind="paymentIntegrationProps"
                @select="(payload) => (selectedPaymentMethod = payload)"
                @payment-success="handlePaymentSuccess"
                @payment-failed="handlePaymentFailed"
            />
        </div>
        <Button
            v-if="!hideSubmitButton"
            intent="primary"
            class="mt-4 w-full"
            :loading="isFormLocked"
            @click="handleSubmit"
            >{{ submitLabel }}</Button
        >
    </Section>
</template>
