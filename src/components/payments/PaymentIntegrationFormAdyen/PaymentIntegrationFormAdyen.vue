<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
    AdyenCheckout,
    Dropin,
    type CoreConfiguration,
    type PaymentAmountExtended,
    type PaymentMethod,
} from '@adyen/adyen-web/auto';
import type {
    Amount,
    AuthorizePaymentPayload,
    PaymentAcceptor,
    PaymentMethodOptionAdyen,
    PaymentMethodOptionResponseEntry,
} from '@solvimon/types';
import { useIntl } from '@solvimon/ui';
import type {
    PaymentIntegrationFormAdyenEmits,
    PaymentIntegrationFormAdyenProps,
} from './PaymentIntegrationFormAdyen.types';
import { getOverriddenTranslations } from './PaymentIntegrationFormAdyen.lib';
import PaymentCompletedCard from '@/components/payments/PaymentCompletedCard/PaymentCompletedCard.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import type { Error } from '@/types/errors';
import adyenStyles from '@/assets/adyen.css?raw';
import { createPaymentsService } from '@/services/payments';
import { trackSentryException } from '@/utils/errorTracking';
import { getQueryParam } from '@/utils/url';
import { createPaymentMethodsService } from '@/services/paymentMethods';

const props = withDefaults(defineProps<PaymentIntegrationFormAdyenProps>(), {
    validateOnSubmit: () => Promise.resolve(true),
});
const emit = defineEmits<PaymentIntegrationFormAdyenEmits>();
defineExpose({ submit });

const REDIRECT_RESULT_QUERY_STRING = 'redirectResult';
const PAYMENT_ACCEPTOR_ID_QUERY_STRING = 'payment_acceptor_id';
const PAYMENT_GATEWAY_VARIANT_ADYEN = 'ADYEN';

const dropInContainerRef = ref();
const dropInInstance = ref<Dropin | null>(null);
const checkoutInstance = ref<Awaited<ReturnType<typeof AdyenCheckout>> | null>();
const showPaymentSuccess = ref(false);
const integrationError = ref<Error>();

const { locale } = useIntl();

const { authorizePayment, getPaymentDetails } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();

function submit() {
    dropInInstance.value?.submit();
}

async function getConfiguration() {
    return {
        checkoutConfig: {
            amount: props.amount ? transformToAdyenAmount(props.amount) : undefined,
            clientKey:
                props.paymentMethodOptionResponseEntry.integration?.payment_gateway?.adyen
                    ?.public_key,
            environment: getEnvironment(props.paymentMethodOptionResponseEntry),
            locale,
            translations: getOverriddenTranslations(props.variant),
            countryCode: props.countryCode,
            analytics: { enabled: false },
            paymentMethodsResponse: {
                paymentMethods:
                    props.paymentMethodOptionResponseEntry.options.flatMap(
                        (adyenPaymentMethodOption) =>
                            mapAdyenPaymentMethod(adyenPaymentMethodOption.adyen)
                    ) ?? [],
            },
            onSubmit: handleOnSubmit,
            onAdditionalDetails: handleOnAdditionalDetails,
            onPaymentCompleted: handleOnPaymentCompleted,
            onPaymentFailed: handleOnPaymentFailed,
            onError: handleOnError,
            showPayButton: false,
        },
        dropInConfig: {
            disableFinalAnimation: true,
            paymentMethodsConfiguration: {
                card: {
                    hasHolderName: true,
                    holderNameRequired: true,
                    enableStoreDetails: props.variant === 'AUTHORIZE',
                },
            },
            openFirstPaymentMethod: props.selected,
            onSelect: () => emit('select'),
        },
    };
}

async function mountDropIn() {
    if (!dropInContainerRef.value) return;

    try {
        await unmountDropIn();

        const { checkoutConfig, dropInConfig } = await getConfiguration();

        checkoutInstance.value = await AdyenCheckout(checkoutConfig);
        dropInInstance.value = new Dropin(checkoutInstance.value, dropInConfig).mount(
            dropInContainerRef.value
        );

        injectStylesToShadowRoot();
    } catch (error) {
        emit('error', {
            code: 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
            message: 'Failed to mount Adyen web drop-in',
            error,
        });
    }
}

async function unmountDropIn() {
    if (dropInInstance.value) {
        dropInInstance.value.unmount?.();
        dropInInstance.value = null;
    }
    if (dropInContainerRef.value) {
        dropInContainerRef.value.innerHTML = '';
    }
}

function injectStylesToShadowRoot() {
    const root = dropInContainerRef.value?.getRootNode();
    if (root instanceof ShadowRoot) {
        // Inject default Adyen styles
        const style = document.createElement('style');
        style.textContent = adyenStyles;

        style.textContent += `
            :host {
                --adyen-sdk-color-background-secondary: transparent;
                --adyen-sdk-color-background-primary: rgb(243 244 246 / 0.5);
                --adyen-sdk-color-outline-secondary: #e5e7eb;
                --adyen-sdk-color-outline-primary: transparent;
                --adyen-sdk-color-background-always-dark: var(--color-primary-500);
                --adyen-sdk-color-background-inverse-primary-hover: var(--color-primary-600);
            }

            .adyen-checkout__payment-method__image__wrapper {
                width: 32px;
                height: 32px;
            }

            .adyen-checkout__payment-method__image {
                height: 32px;
            }

            .adyen-checkout__input-wrapper,
            .adyen-checkout__input {
                border-color: rgb(229, 231, 235);
                border-radius: var(--adyen-sdk-border-radius-s, 4px);
            }

            .adyen-checkout__button,
            .adyen-checkout__payment-method {
                border-radius: var(--adyen-sdk-border-radius-s, 4px);
            }

            .adyen-checkout__payment-method {
                border-color: rgb(229, 231, 235);
                background-color: transparent;
                box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                transition: box-shadow 0.2s ease-in-out;
            }

            .adyen-checkout__payment-method--selected {
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            }

            .adyen-checkout__payment-method:after {
                transform: scale(0%);
            }

            .adyen-checkout__payment-methods-list {
                gap: 12px;
            }

            .adyen-checkout__dropdown__list {
                background-color: white;
                border-radius: var(--adyen-sdk-border-radius-s, 4px);
            }

            .adyen-checkout__payment-method.adyen-checkout__payment-method--selected:after {
                content: '✓';
                width: 20px;
                height: 20px;
                border-radius: 10px;
                background-color: rgb(220 252 231);
                position: absolute;
                top: -8px;
                right: -8px;
                text-align: center;
                line-height: 20px;
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                color: rgb(22 101 52);
                transform: scale(100%);
                font-size: 12px;
            }

            .adyen-checkout__payment-method__header {
                padding: 16px 8px:
            }
            
            .adyen-checkout__payment-method__brands {
                align-items: center;
            }
            .adyen-checkout__payment-method__brand-number {
                line-height: 1;
            }
            .adyen-checkout__button__text {
                font-size: 14px;
            }
            .adyen-checkout__store-details {
                background: transparent;
                padding: 0;
            }
            .adyen-checkout__checkbox__input + .adyen-checkout__checkbox__label:after {
                border-color: rgb(229, 231, 235);
            }
        `;

        root.appendChild(style);
    }
}

function handleOnSubmit(
    ...args: Parameters<NonNullable<CoreConfiguration['onSubmit']>>
): ReturnType<NonNullable<CoreConfiguration['onSubmit']>> {
    const [state, component, actions] = args;

    props
        .validateOnSubmit()
        .then((isValid) => {
            if (!isValid) {
                return;
            }

            const paymentAcceptorId = props.paymentMethodOptionResponseEntry.payment_acceptor.id;

            const adyen: AuthorizePaymentPayload['adyen'] = {
                risk_data: transformObject(state.data.riskData),
                payment_method: transformObject(state.data.paymentMethod),
                browser_info: transformObject(state.data.browserInfo),
            };

            if (props.variant === 'AUTHORIZE') {
                const returnUrl = createReturnUrl({
                    paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
                    redirectUrl: window.location.href,
                });

                authorizePayment({
                    payment_acceptor_id: paymentAcceptorId,
                    ...(props.customerId ? { customer_id: props.customerId } : {}),
                    payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
                    adyen: {
                        ...adyen,
                        store_payment_method: state.data.storePaymentMethod,
                    },
                    amount: props.amount,
                    ...(props.context ? { context: props.context } : {}),
                    return_url: returnUrl,
                })
                    .then((paymentResult) => {
                        const paymentMethodType = state.data.paymentMethod.type;

                        if (
                            paymentResult.status === 'SUCCESS' &&
                            paymentResult.payment.result === 'AUTHORIZED'
                        ) {
                            showPaymentSuccess.value = true;
                            actions.resolve({ resultCode: 'Authorised' });
                            return;
                        }

                        if (paymentResult.status === 'FAILURE') {
                            emit('error', {
                                code: 'AUTHORIZATION_FAILED',
                                message: `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                            });
                            actions.resolve({ resultCode: 'Error' });
                            return;
                        }

                        if (
                            paymentResult.status === 'ACTION_REQUIRED' &&
                            paymentResult.action.payment_gateway_variant ===
                                PAYMENT_GATEWAY_VARIANT_ADYEN
                        ) {
                            component.handleAction({
                                paymentMethodType,
                                method: paymentResult.action.method,
                                url: paymentResult.action.url,
                                data: paymentResult.action.data,
                                type: paymentResult.action.adyen?.action_type,
                            });
                            return;
                        }

                        emit('error', {
                            code: 'AUTHORIZATION_FAILED',
                            message: `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                            error: paymentResult,
                        });
                        actions.resolve({ resultCode: 'Error' });
                    })
                    .catch((error) => {
                        emit('error', {
                            code: 'AUTHORIZATION_FAILED',
                            message: `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                            error,
                        });
                        actions.resolve({ resultCode: 'Error' });
                    });
                return;
            }

            if (props.variant === 'TOKENIZE') {
                const returnUrl = createReturnUrl({
                    paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
                    redirectUrl: window.location.href,
                });

                if (!props.customerId) {
                    throw Error('Missing customer id');
                }

                tokenizePaymentMethod({
                    customer_id: props.customerId,
                    payment_acceptor_id: paymentAcceptorId,
                    payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
                    adyen,
                    returnUrl,
                })
                    .then((paymentResult) => {
                        const paymentMethodType = state.data.paymentMethod.type;

                        if (
                            paymentResult.status === 'SUCCESS' &&
                            paymentResult.payment.result === 'AUTHORIZED'
                        ) {
                            showPaymentSuccess.value = true;
                            actions.resolve({ resultCode: 'Authorised' });
                            return;
                        }

                        if (paymentResult.status === 'FAILURE') {
                            emit('error', {
                                code: 'TOKENIZE_FAILED',
                                message: 'Tokenization failed',
                            });
                            actions.resolve({ resultCode: 'Error' });
                            return;
                        }

                        if (
                            paymentResult.status === 'ACTION_REQUIRED' &&
                            paymentResult.action.payment_gateway_variant ===
                                PAYMENT_GATEWAY_VARIANT_ADYEN
                        ) {
                            component.handleAction({
                                paymentMethodType,
                                method: paymentResult.action.method,
                                url: paymentResult.action.url,
                                data: paymentResult.action.data,
                                type: paymentResult.action.adyen?.action_type,
                            });
                            return;
                        }

                        emit('error', {
                            code: 'TOKENIZE_FAILED',
                            message: 'Tokenization failed',
                            error: paymentResult,
                        });
                        actions.resolve({ resultCode: 'Error' });
                    })
                    .catch((error) => {
                        emit('error', {
                            code: 'TOKENIZE_FAILED',
                            message: 'Tokenization failed',
                            error,
                        });
                        actions.resolve({ resultCode: 'Error' });
                    });
            }
        })
        .catch(() => {});
}

function handleOnAdditionalDetails(
    ...args: Parameters<NonNullable<CoreConfiguration['onAdditionalDetails']>>
): ReturnType<NonNullable<CoreConfiguration['onAdditionalDetails']>> {
    const [state] = args;
    const redirectResult = state.data.details.redirectResult;
    const threeDSResult = state.data.details.threeDSResult;

    if (
        (redirectResult || threeDSResult) &&
        props.paymentMethodOptionResponseEntry.payment_acceptor.id
    ) {
        handlePaymentDetails({
            threeDSResult,
            redirectResult,
            paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
        });
    }
}

function handleOnPaymentFailed(
    ...args: Parameters<NonNullable<CoreConfiguration['onPaymentFailed']>>
): ReturnType<NonNullable<CoreConfiguration['onPaymentFailed']>> {
    const [data] = args;
    emit('payment-failed', {
        code: 'UNKNOWN_ERROR',
        message: 'Payment failed',
        error: data,
    });
}

function handleOnPaymentCompleted(
    ...args: Parameters<NonNullable<CoreConfiguration['onPaymentCompleted']>>
): ReturnType<NonNullable<CoreConfiguration['onPaymentCompleted']>> {
    const [, component] = args;
    component?.unmount();
    emit('payment-success');
}

function handleOnError(
    ...args: Parameters<NonNullable<CoreConfiguration['onError']>>
): ReturnType<NonNullable<CoreConfiguration['onError']>> {
    const [error, component] = args;
    emit('error', { code: 'UNKNOWN_ERROR', message: 'Something went wrong', error });
    component?.unmount();
}

function handlePaymentDetails({
    threeDSResult,
    redirectResult,
    paymentAcceptorId,
}: {
    threeDSResult?: string;
    redirectResult?: string;
    paymentAcceptorId: PaymentAcceptor['id'];
}) {
    getPaymentDetails({
        paymentAcceptorId,
        paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_ADYEN,
        adyen: {
            ...(redirectResult ? { redirect_result: redirectResult } : {}),
            ...(threeDSResult ? { threeds_result: threeDSResult } : {}),
        },
    })
        .then((result) => {
            if (result.payment_status === 'FAILURE') {
                emit('payment-failed', {
                    code: 'UNKNOWN_ERROR',
                    message: 'Failed getting payment details',
                    error: result,
                });
                return;
            }

            if (result.payment_status === 'SUCCESS') {
                emit('payment-success');
                return;
            }
        })
        .catch((error) => {
            emit('error', {
                code: 'PAYMENT_DETAILS_CALL_FAILED',
                message: 'Failed fetching payment details',
                error,
            });
        });
}

/**
 * For some payment methods we need to do a redirect. That redirect usually returns a result that
 * we can use to continue the payment flow. Here we're checking if the redirect result is available
 * in a query string and act accordingly.
 */
function handleRedirectResult() {
    const redirectResult = getQueryParam(REDIRECT_RESULT_QUERY_STRING);
    const paymentAcceptorId = getQueryParam(PAYMENT_ACCEPTOR_ID_QUERY_STRING);

    if (!redirectResult) {
        return;
    }

    if (!paymentAcceptorId) {
        emit('error', {
            code: 'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING',
            message: 'Redirect result is set but payment acceptor id is missing',
        });
        return;
    }

    handlePaymentDetails({
        paymentAcceptorId,
        redirectResult: decodeURI(redirectResult),
    });
}

function mapAdyenPaymentMethod(adyen: PaymentMethodOptionAdyen['adyen']): PaymentMethod {
    return {
        type: adyen.type,
        name: adyen.name,
        issuers: adyen.issuers ?? [],
        brands: adyen.brands ?? [],
        fundingSource: adyen.funding_source,
    };
}

/**
 * Transforms a Solvimon amount to an Adyen amount.
 */
function transformToAdyenAmount(amount: Amount): PaymentAmountExtended {
    const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: amount.currency,
    });

    const { maximumFractionDigits = 10 } = formatter.resolvedOptions();

    return {
        value: Math.round(+amount.quantity * Math.pow(10, maximumFractionDigits)),
        currency: amount.currency,
    };
}

/**
 * Maps the environment from uppercase (as saved in the backend), to lowercase (as used
 * by the Adyen SDK).
 */
function getEnvironment(entry: PaymentMethodOptionResponseEntry): CoreConfiguration['environment'] {
    const environment = entry.integration.payment_gateway?.adyen?.environment;

    if (!environment) {
        trackSentryException(undefined, {
            Message: 'No environment set for adyen advanced flow, defaulted to live',
        });
        return 'live';
    }

    switch (environment) {
        case 'TEST':
            return 'test';
        case 'LIVE':
            return 'live';
        default:
            trackSentryException(undefined, {
                Message: `Unsupported environment "${environment}" for adyen advanced flow, defaulted to "live"`,
            });
            return 'live';
    }
}

function transformObject(obj?: Object) {
    return obj
        ? Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, String(value)]))
        : undefined;
}

function createReturnUrl({
    paymentAcceptorId,
    redirectUrl = window.location.href,
}: {
    redirectUrl?: string;
    paymentAcceptorId: string;
}): string {
    const returnUrl = new URL(redirectUrl);
    returnUrl.searchParams.set(PAYMENT_ACCEPTOR_ID_QUERY_STRING, paymentAcceptorId);
    return returnUrl.toString();
}

onMounted(() => {
    void mountDropIn();
    handleRedirectResult();
});

onBeforeUnmount(() => {
    void unmountDropIn();
});

// 🔁 Re-mount when paymentMethodOptions change
watch(
    () => props.paymentMethodOptionResponseEntry,
    () => {
        void mountDropIn();
    },
    { deep: true }
);
</script>

<template>
    <PaymentCompletedCard v-if="showPaymentSuccess" :variant="variant" />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" />
    <div ref="dropInContainerRef"></div>
</template>
