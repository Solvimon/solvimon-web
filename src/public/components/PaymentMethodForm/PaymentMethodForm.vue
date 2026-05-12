<script setup lang="ts">
import { getCustomerCountry, Section, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { Amount } from '@solvimon/solvimon-types';
import type {
    PaymentMethodFormConfiguration,
    PaymentMethodFormProps,
} from './PaymentMethodForm.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import type { PaymentIntegrationFormProps } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

const FALLBACK_COUNTRY_CODE = 'NL';
const DEFAULT_AMOUNT: Amount = {
    currency: 'EUR',
    quantity: '0',
};

const props = withDefaults(defineProps<PaymentMethodFormProps>(), {
    isLoading: false,
});

const { $t } = useIntl();

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
    if (configuration.value.variant === 'AUTHORIZE') {
        return {
            paymentMethodOptions: props.paymentMethodOptions,
            countryCode: countryCode.value,
            variant: 'AUTHORIZE',
            amount: configuration.value.amount,
            context: configuration.value.context,
            invoiceId: configuration.value.invoiceId,
            successRedirectUrl: configuration.value.successRedirectUrl,
            selectedOption: configuration.value.selectedOption,
            validateOnSubmit: configuration.value.validateOnSubmit,
            forceStorePaymentMethod: configuration.value.forceStorePaymentMethod,
        };
    }

    return {
        paymentMethodOptions: props.paymentMethodOptions,
        customerId: props.customer.id,
        countryCode: countryCode.value,
        variant: 'TOKENIZE',
        amount: configuration.value.amount ?? DEFAULT_AMOUNT,
        invoiceId: configuration.value.invoiceId,
        successRedirectUrl: configuration.value.successRedirectUrl,
        selectedOption: configuration.value.selectedOption,
        validateOnSubmit: configuration.value.validateOnSubmit,
        forceStorePaymentMethod: configuration.value.forceStorePaymentMethod,
    };
});
</script>

<template>
    <Skeleton v-if="isLoading" variant="section" class="min-h-[180px]" data-testid="payment-method-form-skeleton" />
    <Section
        v-else
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
        <PaymentIntegrationForm v-bind="paymentIntegrationProps" />
    </Section>
</template>
