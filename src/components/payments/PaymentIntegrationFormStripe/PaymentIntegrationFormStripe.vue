<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Stripe } from '@stripe/stripe-js';
import type { AuthorizePaymentResponse } from '@solvimon/solvimon-types';
import type {
    PaymentIntegrationFormStripeEmits,
    PaymentIntegrationFormStripeProps,
} from './PaymentIntegrationFormStripe.types';
import PaymentIntegrationFormStripeFrame from './PaymentIntegrationFormStripeFrame.vue';
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

// Loaded lazily — only needed for handleNextAction (3DS), which appends to
// document.body and works fine outside the shadow root.
let parentStripe: Stripe | null = null;

const props = withDefaults(defineProps<PaymentIntegrationFormStripeProps>(), {
    validateOnSubmit: () => Promise.resolve(true),
});
const emit = defineEmits<PaymentIntegrationFormStripeEmits>();
defineExpose({ submit });

const PAYMENT_GATEWAY_VARIANT_STRIPE = 'STRIPE';

const frameRef = ref<InstanceType<typeof PaymentIntegrationFormStripeFrame>>();
const showPaymentSuccess = ref(false);
const integrationError = ref<Error>();

const logger = useLogger();
const { authorizePayment } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();

const publicKey = computed(
    () => props.paymentMethodOptionResponseEntry.integration.payment_gateway?.stripe?.public_key,
);

const frameOptions = computed(() => {
    const currency = props.amount.currency.toLowerCase();

    if (props.variant === 'TOKENIZE') {
        return { mode: 'setup' as const, currency };
    }

    return {
        mode: 'payment' as const,
        amount: transformToAdyenAmount(props.amount).value,
        currency,
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

async function getParentStripeInstance(): Promise<Stripe> {
    if (parentStripe) return parentStripe;
    const key = publicKey.value;
    if (!key) throw new Error('Missing Stripe public key');
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripe = await loadStripe(key);
    if (!stripe) throw new Error('Failed to load Stripe.js');
    parentStripe = stripe;
    return parentStripe;
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
                ...(props.context ? { context: props.context } : {}),
                return_url: returnUrl,
            });
            await handlePaymentResult(result);
        } catch (error) {
            logger.error(
                'PAYMENT_AUTHORIZATION_FAILED',
                `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                { error },
            );
            const err: Error = {
                code: 'UNKNOWN_ERROR',
                message: 'Payment authorization failed',
                error,
            };
            integrationError.value = err;
            emit('payment-failed', err);
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
            const err: Error = {
                code: 'UNKNOWN_ERROR',
                message: 'Tokenization failed',
                error,
            };
            integrationError.value = err;
            emit('payment-failed', err);
        }
    }
}

async function handlePaymentResult(result: AuthorizePaymentResponse) {
    if (
        result.status === 'ACTION_REQUIRED' &&
        result.action.payment_gateway_variant === PAYMENT_GATEWAY_VARIANT_STRIPE
    ) {
        if (!result.action.client_secret) {
            logger.error('STRIPE_ACTION_FAILED', 'Missing client_secret in Stripe ACTION_REQUIRED response');
            const err: Error = { code: 'UNKNOWN_ERROR', message: 'Payment action failed', error: result };
            integrationError.value = err;
            emit('payment-failed', err);
            return;
        }

        const stripe = await getParentStripeInstance().catch(() => null);
        if (!stripe) return;

        const { error } = await stripe.handleNextAction({
            clientSecret: result.action.client_secret,
        });

        if (error) {
            logger.error('STRIPE_ACTION_FAILED', 'Stripe handleNextAction failed', { error });
            const err: Error = {
                code: 'UNKNOWN_ERROR',
                message: 'Payment action failed',
                error,
            };
            integrationError.value = err;
            emit('payment-failed', err);
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
    const err: Error = { code: 'UNKNOWN_ERROR', message: 'Payment failed', error: result };
    integrationError.value = err;
    emit('payment-failed', err);
}

/* eslint-disable no-console */
async function handleRedirectReturn() {
    const paymentAcceptorId = props.paymentMethodOptionResponseEntry.payment_acceptor.id;
    const urlPaymentAcceptorId = getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING);
    console.log('[Stripe] handleRedirectReturn', { urlPaymentAcceptorId, paymentAcceptorId });
    if (urlPaymentAcceptorId !== paymentAcceptorId) return;

    const redirectStatus = getQueryParam('redirect_status');
    const paymentIntentClientSecret = getQueryParam('payment_intent_client_secret');
    const setupIntentClientSecret = getQueryParam('setup_intent_client_secret');
    console.log('[Stripe] redirect params', {
        redirectStatus,
        paymentIntentClientSecret,
        setupIntentClientSecret,
    });
    if (!redirectStatus) return;

    if (!paymentIntentClientSecret && !setupIntentClientSecret) return;

    if (redirectStatus === 'succeeded') {
        showPaymentSuccess.value = true;
        emit('payment-success');
        return;
    }

    console.error('[Stripe] redirect return failed', { redirectStatus });
    const err: Error = {
        code: 'UNKNOWN_ERROR',
        message: 'Payment failed',
        error: new globalThis.Error(`Stripe redirect returned status: ${redirectStatus}`),
    };
    integrationError.value = err;
    emit('payment-failed', err);
}

onMounted(() => {
    handleRedirectReturn().catch((error) => {
        console.error('[Stripe] handleRedirectReturn threw', error);
    });
});
/* eslint-enable no-console */

onBeforeUnmount(() => {
    parentStripe = null;
});
</script>

<template>
    {{ integrationError }}
    <PaymentCompletedCard v-if="showPaymentSuccess" :variant="variant" />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" />
    <PaymentIntegrationFormStripeFrame
        v-else-if="publicKey"
        ref="frameRef"
        :public-key="publicKey"
        :options="frameOptions"
        @ready="
            emit('select', {
                paymentMethodType: 'card',
                paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_STRIPE,
            });
            emit('ready');
        "
        @change="
            (type) =>
                emit('select', {
                    paymentMethodType: type,
                    paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_STRIPE,
                })
        "
        @loaderror="
            (error) => {
                integrationError = {
                    code: 'UNKNOWN_ERROR',
                    message: error.message ?? 'Failed to load payment form',
                    error,
                };
            }
        "
        @submit-success="(id) => handleConfirmationToken(id)"
        @submit-error="
            (error) =>
                logger.error('STRIPE_CONFIRMATION_TOKEN_FAILED', 'Stripe submission failed', {
                    error,
                })
        "
    />
</template>
