<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Stripe } from '@stripe/stripe-js';
import type { AuthorizePaymentResponse } from '@solvimon/solvimon-types';
import type {
    PaymentIntegrationFormStripeEmits,
    PaymentIntegrationFormStripeProps,
} from './PaymentIntegrationFormStripe.types';
import PaymentIntegrationFormStripeFrame from './PaymentIntegrationFormStripeFrame.vue';
import type {
    PaymentIntegrationFormStripeFrameProps,
    StripeLoadError,
    StripeSubmitError,
} from './PaymentIntegrationFormStripeFrame.types.ts';
import { getFrameOptions } from './PaymentIntegrationFormStripe.lib.ts';
import { STRIPE_SCRIPT_URL } from './PaymentIntegrationFormStripe.constants.ts';
import PaymentCompletedCard from '@/components/payments/PaymentCompletedCard/PaymentCompletedCard.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import type { Error } from '@/types/errors';
import { createPaymentsService } from '@/services/payments';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import { createReturnUrl, PAYMENT_ACCEPTOR_ID_QUERY_STRING } from '@/utils/adyen';
import { getQueryParam } from '@/utils/url';
import { useLogger } from '@/components/providers';
import {
    createPaymentFailureContext,
    createPaymentFailureError,
    type PaymentFailureParams,
} from '@/utils/paymentFailure';

const props = withDefaults(defineProps<PaymentIntegrationFormStripeProps>(), {
    validateOnSubmit: () => Promise.resolve(true),
});
const emit = defineEmits<PaymentIntegrationFormStripeEmits>();
defineExpose({ submit });

const PAYMENT_GATEWAY_VARIANT_STRIPE = 'STRIPE';

const showPaymentSuccess = ref<boolean>(false);
const integrationError = ref<Error>();
const frameRef = ref<InstanceType<typeof PaymentIntegrationFormStripeFrame>>();
/**
 * Whether the method is kept for later, read the way the Adyen integration reads it: an answer from
 * the screen decides, and a screen that only ever stores says so with `forceStorePaymentMethod`.
 * Stripe has no checkbox of its own to fall back to, so silence means not keeping it.
 */
const storePaymentMethod = computed(
    () => props.storePaymentMethod ?? props.forceStorePaymentMethod ?? false,
);

const frameOptions = computed<PaymentIntegrationFormStripeFrameProps['options']>(() =>
    getFrameOptions({
        amount: props.amount,
        email: props.email,
        name: props.name,
        variant: props.variant,
        storePaymentMethod: storePaymentMethod.value,
    }),
);

// Loaded lazily — only needed for handleNextAction (3DS), which appends to
// document.body and works fine outside the shadow root.
const stripeInstance = ref<Stripe | null>(null);

const logger = useLogger();
const { authorizePayment } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();

const publicKey = computed(
    () => props.paymentMethodOptionResponseEntry.integration.payment_gateway?.stripe?.public_key,
);

/** The context every failure in this form is logged with, filled in from what the form knows. */
function failureContext(params: Omit<PaymentFailureParams, 'gateway'>): Record<string, unknown> {
    return createPaymentFailureContext({
        gateway: PAYMENT_GATEWAY_VARIANT_STRIPE,
        paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
        variant: props.variant,
        invoiceId: props.invoiceId,
        customerId: props.customerId,
        ...params,
    });
}

function submit() {
    handleSubmit().catch((error) => {
        logger.error(
            'STRIPE_SUBMIT_FAILED',
            'Unexpected error during Stripe submission',
            failureContext({ reason: 'STRIPE_SUBMIT_FAILED', cause: error }),
            error,
        );
    });
}

async function handleSubmit() {
    const isValid = await props.validateOnSubmit();

    if (!isValid || !frameRef.value) {
        emit('invalid');
        return;
    }

    frameRef.value.triggerSubmit();
}

function handleSubmitError(error: StripeSubmitError) {
    if (error.type === 'validation_error') {
        emit('invalid');
        return;
    }

    logger.error(
        'STRIPE_CONFIRMATION_TOKEN_FAILED',
        'Stripe submission failed',
        failureContext({ reason: 'STRIPE_CONFIRMATION_TOKEN_FAILED', cause: error }),
        error,
    );
    emitError({
        code: props.variant === 'TOKENIZE' ? 'TOKENIZE_FAILED' : 'AUTHORIZATION_FAILED',
        message: error.message ?? 'Stripe submission failed',
        error,
    });
}

function loadStripeDahlia(key: string): Promise<Stripe> {
    return new Promise<Stripe>((resolve, reject) => {
        if (window.Stripe) {
            resolve(window.Stripe(key));
            return;
        }
        const script = document.createElement('script');
        script.src = STRIPE_SCRIPT_URL;
        script.onload = () => {
            if (!window.Stripe) {
                reject(new Error('Stripe not available after script load'));
                return;
            }
            resolve(window.Stripe(key));
        };
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
    });
}

async function getStripeInstance(): Promise<Stripe> {
    if (stripeInstance.value) {
        return stripeInstance.value;
    }

    const key = publicKey.value;
    if (!key) {
        throw new Error('Missing Stripe public key');
    }

    const stripe = await loadStripeDahlia(key);
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
                failureContext({ reason: 'PAYMENT_AUTHORIZATION_FAILED', cause: error }),
                error,
            );
            emitError({
                code: 'AUTHORIZATION_FAILED',
                message: 'Payment authorization failed',
                error,
            });
        }
        return;
    }

    if (props.variant === 'TOKENIZE') {
        if (!props.customerId) {
            logger.error(
                'TOKENIZATION_FAILED',
                `Missing customer id for payment acceptor with id ${paymentAcceptorId}`,
                failureContext({ reason: 'TOKENIZATION_FAILED_NO_CUSTOMER' }),
            );
            // Returning quietly used to leave the customer looking at a form that had already
            // taken their details and would never do anything with them.
            emitError({ code: 'TOKENIZE_FAILED', message: 'Missing customer id' });
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
                failureContext({ reason: 'TOKENIZATION_FAILED', cause: error }),
                error,
            );
            emitError({ code: 'TOKENIZE_FAILED', message: 'Tokenization failed', error });
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
                failureContext({
                    reason: 'STRIPE_ACTION_MISSING_CLIENT_SECRET',
                    extra: { paymentStatus: result.status },
                }),
            );
            emitError({
                code: 'AUTHORIZATION_FAILED',
                message: 'Payment action failed',
                error: result,
            });
            return;
        }

        let stripe: Stripe;
        try {
            stripe = await getStripeInstance();
        } catch (error) {
            logger.error(
                'STRIPE_ACTION_FAILED',
                'Failed to load Stripe.js',
                failureContext({ reason: 'STRIPE_SDK_LOAD_FAILED', cause: error }),
                error,
            );
            emitError({ code: 'AUTHORIZATION_FAILED', message: 'Payment action failed', error });
            return;
        }

        const { error } = await stripe.handleNextAction({ clientSecret });

        if (error) {
            logger.error(
                'STRIPE_ACTION_FAILED',
                'Stripe handleNextAction failed',
                failureContext({
                    reason: 'STRIPE_NEXT_ACTION_FAILED',
                    cause: error,
                    extra: { stripeErrorCode: error.code, stripeErrorType: error.type },
                }),
                error,
            );
            emitError({ code: 'AUTHORIZATION_FAILED', message: 'Payment action failed', error });
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

    logger.error(
        'STRIPE_ACTION_FAILED',
        'Unexpected payment result status',
        failureContext({
            reason: 'STRIPE_UNEXPECTED_PAYMENT_STATUS',
            extra: { paymentStatus: result.status },
        }),
    );
    emitError({ code: 'AUTHORIZATION_FAILED', message: 'Payment failed', error: result });
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

    const redirectError = new globalThis.Error(
        `Stripe redirect returned status: ${redirectStatus}`,
    );
    logger.error(
        'STRIPE_REDIRECT_RETURN_FAILED',
        'Stripe redirect returned non-succeeded status',
        failureContext({
            reason: 'STRIPE_REDIRECT_RETURN_FAILED',
            extra: { redirectStatus },
        }),
        redirectError,
    );
    emitError({
        code: 'AUTHORIZATION_FAILED',
        message: 'Payment failed',
        error: redirectError,
    });
}

function handleReady() {
    emit('select', {
        paymentMethodType: 'card',
        paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_STRIPE,
    });
    emit('ready');
}

function handleLoadError(error: StripeLoadError) {
    logger.error(
        'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
        'Failed to load the Stripe payment form',
        failureContext({
            reason: 'STRIPE_FORM_LOAD_FAILED',
            cause: error,
            extra: { stripeErrorType: error.type },
        }),
        error,
    );
    emitError({
        code: 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
        message: error.message ?? 'Failed to load payment form',
        error,
    });
}

/**
 * Every failure leaves through here, so the card the customer sees always carries the reference
 * they can quote back to support.
 */
function emitError(err: Omit<Error, 'reference'>) {
    const failure = createPaymentFailureError(err);
    integrationError.value = failure;
    emit('payment-failed', failure);
}

onMounted(() => {
    handleRedirectReturn().catch((error) => {
        logger.error(
            'STRIPE_REDIRECT_RETURN_FAILED',
            'handleRedirectReturn threw unexpectedly',
            failureContext({ reason: 'STRIPE_REDIRECT_RETURN_THREW', cause: error }),
            error,
        );
    });
});

onBeforeUnmount(() => {
    stripeInstance.value = null;
});
</script>

<template>
    <PaymentCompletedCard
        v-if="showPaymentSuccess"
        :variant="variant"
        :redirecting="redirectsOnSuccess"
    />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" />
    <PaymentIntegrationFormStripeFrame
        v-else-if="publicKey"
        ref="frameRef"
        :public-key="publicKey"
        :options="frameOptions"
        :country-code="countryCode"
        :email="email"
        :name="name"
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
        @submit-error="handleSubmitError"
    />
</template>
