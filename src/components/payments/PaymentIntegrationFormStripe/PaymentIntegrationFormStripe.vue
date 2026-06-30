<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Stripe } from '@stripe/stripe-js';
import type { AuthorizePaymentResponse } from '@solvimon/solvimon-types';
import type {
    PaymentIntegrationFormStripeEmits,
    PaymentIntegrationFormStripeProps,
} from './PaymentIntegrationFormStripe.types';
import PaymentIntegrationFormStripeFrame from './PaymentIntegrationFormStripeFrame.vue';
import type { PaymentIntegrationFormStripeFrameProps } from './PaymentIntegrationFormStripeFrame.types.ts';
import PaymentCompletedCard from '@/components/payments/PaymentCompletedCard/PaymentCompletedCard.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import type { Error } from '@/types/errors';
import { createPaymentsService } from '@/services/payments';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import {
    createReturnUrl,
    transformToAdyenAmount,
    PAYMENT_ACCEPTOR_ID_QUERY_STRING,
} from '@/utils/adyen';
import { getQueryParam } from '@/utils/url';
import { useLogger } from '@/components/providers';

const STRIPE_WALLETS = { link: 'never' as const };
const STRIPE_APPEARANCE = {
    variables: { borderRadius: '4px', colorBackground: 'rgba(243, 244, 246, 0.5)' },
    rules: {
        '.TermsText': { fontSize: '14px' },
        '.Input': {
            backgroundColor: 'rgba(243, 244, 246, 0.5)',
            fontSize: '14px',
            borderColor: 'rgb(229, 231, 235)',
        },
    },
};

const props = withDefaults(defineProps<PaymentIntegrationFormStripeProps>(), {
    validateOnSubmit: () => Promise.resolve(true),
});
const emit = defineEmits<PaymentIntegrationFormStripeEmits>();
defineExpose({ submit });

const PAYMENT_GATEWAY_VARIANT_STRIPE = 'STRIPE';

const frameRef = ref<InstanceType<typeof PaymentIntegrationFormStripeFrame>>();
const showPaymentSuccess = ref(false);
const integrationError = ref<Error>();

// Loaded lazily — only needed for handleNextAction (3DS), which appends to
// document.body and works fine outside the shadow root.
const stripeInstance = ref<Stripe | null>(null);

const logger = useLogger();
const { authorizePayment } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();

const publicKey = computed(
    () => props.paymentMethodOptionResponseEntry.integration.payment_gateway?.stripe?.public_key,
);

const frameOptions = computed<PaymentIntegrationFormStripeFrameProps['options']>(() => {
    const currency = props.amount.currency.toLowerCase();
    const fields = {
        billingDetails: {
            address: { country: 'never' as const },
            ...(props.email ? { email: 'never' as const } : {}),
        },
    };

    if (props.variant === 'TOKENIZE') {
        return {
            mode: 'setup' as const,
            currency,
            setup_future_usage: 'off_session',
            wallets: STRIPE_WALLETS,
            fields,
            appearance: STRIPE_APPEARANCE,
        };
    }

    return {
        mode: 'payment' as const,
        amount: transformToAdyenAmount(props.amount).value,
        currency,
        setup_future_usage: 'off_session',
        wallets: STRIPE_WALLETS,
        fields,
        appearance: STRIPE_APPEARANCE,
    };
});

function submit() {
    handleSubmit().catch((error) => {
        logger.error(
            'STRIPE_SUBMIT_FAILED',
            'Unexpected error during Stripe submission',
            {},
            error,
        );
    });
}

async function handleSubmit() {
    const isValid = await props.validateOnSubmit();
    if (!isValid) return;
    frameRef.value?.triggerSubmit();
}

async function getStripeInstance(): Promise<Stripe> {
    if (stripeInstance.value) return stripeInstance.value;
    const key = publicKey.value;
    if (!key) throw new Error('Missing Stripe public key');
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(key);
    if (!stripe) throw new Error('Failed to load Stripe.js');
    stripeInstance.value = stripe;
    return stripe;
}

async function handleConfirmationToken(confirmationTokenId: string) {
    const paymentAcceptorId = props.paymentMethodOptionResponseEntry.payment_acceptor.id;
    const returnUrl = createReturnUrl({
        paymentAcceptorId,
        redirectUrl: window.location.href,
    });

    if (props.variant === 'AUTHORIZE') {
        try {
            const result = await authorizePayment({
                payment_acceptor_id: paymentAcceptorId,
                ...(props.customerId ? { customer_id: props.customerId } : {}),
                payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_STRIPE,
                stripe: { confirmation_token_id: confirmationTokenId },
                amount: props.amount,
                ...(props.context && props.context.type !== 'CHARGE_ON_DEMAND'
                    ? { context: props.context }
                    : {}),
                return_url: returnUrl,
            });
            await handlePaymentResult(result);
        } catch (error) {
            logger.error(
                'PAYMENT_AUTHORIZATION_FAILED',
                `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                { error },
            );
            emitError({ code: 'UNKNOWN_ERROR', message: 'Payment authorization failed', error });
        }
        return;
    }

    if (props.variant === 'TOKENIZE') {
        if (!props.customerId) {
            logger.error(
                'TOKENIZATION_FAILED',
                `Missing customer id for payment acceptor with id ${paymentAcceptorId}`,
            );
            return;
        }
        try {
            const result = await tokenizePaymentMethod({
                customer_id: props.customerId,
                payment_acceptor_id: paymentAcceptorId,
                payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_STRIPE,
                stripe: { confirmation_token_id: confirmationTokenId },
                return_url: returnUrl,
            });
            await handlePaymentResult(result);
        } catch (error) {
            logger.error(
                'TOKENIZATION_FAILED',
                `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                { error },
            );
            emitError({ code: 'UNKNOWN_ERROR', message: 'Tokenization failed', error });
        }
    }
}

async function handlePaymentResult(result: AuthorizePaymentResponse) {
    if (
        result.status === 'ACTION_REQUIRED' &&
        result.action.payment_gateway_variant === PAYMENT_GATEWAY_VARIANT_STRIPE
    ) {
        const clientSecret = result.action.client_secret || result.action.data?.client_secret;
        if (!clientSecret) {
            logger.error(
                'STRIPE_ACTION_FAILED',
                'Missing client_secret in Stripe ACTION_REQUIRED response',
            );
            emitError({ code: 'UNKNOWN_ERROR', message: 'Payment action failed', error: result });
            return;
        }

        let stripe: Stripe;
        try {
            stripe = await getStripeInstance();
        } catch (error) {
            logger.error('STRIPE_ACTION_FAILED', 'Failed to load Stripe.js', { error });
            emitError({ code: 'UNKNOWN_ERROR', message: 'Payment action failed', error });
            return;
        }

        const { error } = await stripe.handleNextAction({ clientSecret });

        if (error) {
            logger.error('STRIPE_ACTION_FAILED', 'Stripe handleNextAction failed', { error });
            emitError({ code: 'UNKNOWN_ERROR', message: 'Payment action failed', error });
            return;
        }

        showPaymentSuccess.value = true;
        emit('payment-success');
        return;
    }

    if (result.status === 'SUCCESS') {
        showPaymentSuccess.value = true;
        emit('payment-success');
        return;
    }

    logger.error('STRIPE_ACTION_FAILED', 'Unexpected payment result status', { error: result });
    emitError({ code: 'UNKNOWN_ERROR', message: 'Payment failed', error: result });
}

async function handleRedirectReturn() {
    const paymentAcceptorId = props.paymentMethodOptionResponseEntry.payment_acceptor.id;
    const urlPaymentAcceptorId = getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING);
    if (urlPaymentAcceptorId !== paymentAcceptorId) return;

    const redirectStatus = getQueryParam('redirect_status');
    const paymentIntentClientSecret = getQueryParam('payment_intent_client_secret');
    const setupIntentClientSecret = getQueryParam('setup_intent_client_secret');

    if (!redirectStatus || (!paymentIntentClientSecret && !setupIntentClientSecret)) return;

    if (redirectStatus === 'succeeded') {
        showPaymentSuccess.value = true;
        emit('payment-success');
        return;
    }

    logger.error('STRIPE_REDIRECT_RETURN_FAILED', 'Stripe redirect returned non-succeeded status', {
        redirectStatus,
    });
    emitError({
        code: 'UNKNOWN_ERROR',
        message: 'Payment failed',
        error: new globalThis.Error(`Stripe redirect returned status: ${redirectStatus}`),
    });
}

function handleReady() {
    emit('select', {
        paymentMethodType: 'card',
        paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_STRIPE,
    });
    emit('ready');
}

function handleLoadError(error: { message?: string; type?: string }) {
    emitError({
        code: 'UNKNOWN_ERROR',
        message: error.message ?? 'Failed to load payment form',
        error,
    });
}

function emitError(err: Error) {
    integrationError.value = err;
    emit('payment-failed', err);
}

onMounted(() => {
    handleRedirectReturn().catch((error) => {
        logger.error('STRIPE_REDIRECT_RETURN_FAILED', 'handleRedirectReturn threw unexpectedly', {
            error,
        });
    });
});

onBeforeUnmount(() => {
    stripeInstance.value = null;
});
</script>

<template>
    <PaymentCompletedCard v-if="showPaymentSuccess" :variant="variant" />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" />
    <PaymentIntegrationFormStripeFrame
        v-else-if="publicKey"
        ref="frameRef"
        :public-key="publicKey"
        :options="frameOptions"
        :country-code="countryCode"
        :email="email"
        @ready="handleReady"
        @change="
            (type) =>
                emit('select', {
                    paymentMethodType: type,
                    paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_STRIPE,
                })
        "
        @loaderror="handleLoadError"
        @submit-success="handleConfirmationToken"
        @submit-error="
            (error) =>
                logger.error('STRIPE_CONFIRMATION_TOKEN_FAILED', 'Stripe submission failed', {
                    error,
                })
        "
    />
</template>
