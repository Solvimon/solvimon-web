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

const paymentIntegrationFormRef = ref<InstanceType<typeof PaymentIntegrationForm>>();
const selectedPaymentMethod = ref<SelectedPaymentMethod>();
const isPaymentPending = ref(false);

function handleSubmit() {
    isPaymentPending.value = true;
    paymentIntegrationFormRef.value?.submit();
}

function handlePaymentSuccess() {
    isPaymentPending.value = false;
    emit('payment-success');
}

function handlePaymentFailed(error: unknown) {
    isPaymentPending.value = false;
    emit('payment-failed', error);
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
    <Section
        v-else
        class="sv-payment-method-form sv-root sv-component"
        no-border
        no-spacing
        content-background="none"
        :title="
            $t({
                defaultMessage: 'Available payment methods',
                description: 'Title of the available payment methods form',
                id: 'components.payment_method_form.section_title',
            })
        "
    >
        <div :class="{ 'pointer-events-none opacity-60': isPaymentPending }">
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
            color="primary"
            class="mt-4 w-full"
            :loading="isPaymentPending"
            @click="handleSubmit"
            >Save payment method</Button
        >
    </Section>
</template>
