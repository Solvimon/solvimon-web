<script setup lang="ts">
import adyenCss from '@adyen/adyen-web/styles/adyen.css?inline';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CoreConfiguration, DropinConfiguration, PaymentAction } from '@adyen/adyen-web/auto';
import type {
    AuthorizePaymentPayload,
    AuthorizePaymentResponse,
    PaymentAcceptor,
} from '@solvimon/solvimon-types';
import { useIntl } from '@solvimon/solvimon-ui';
import { isEqual } from 'lodash';
import type {
    PaymentIntegrationFormAdyenEmits,
    PaymentIntegrationFormAdyenProps,
} from './PaymentIntegrationFormAdyen.types';
import { getOverriddenTranslations } from './PaymentIntegrationFormAdyen.lib';
import PaymentCompletedCard from '@/components/payments/PaymentCompletedCard/PaymentCompletedCard.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import type { Error } from '@/types/errors';
import { createPaymentsService } from '@/services/payments';
import { getQueryParam } from '@/utils/url';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import {
    createReturnUrl,
    getAdyenClientKeyFromPaymentMethodOptionsResponse,
    getAdyenEnvironmentFromPaymentMethodOptionsResponse,
    mapAdyenPaymentMethods,
    PAYMENT_ACCEPTOR_ID_QUERY_STRING,
    REDIRECT_RESULT_QUERY_STRING,
    transformObjectToAdyenObject,
    transformToAdyenAmount,
} from '@/utils/adyen';
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import { filterOutExpressPaymentMethods } from '@/utils/paymentMethods';
import { useLogger } from '@/components/providers';

/**
 * The Adyen instances should be stored in plain objects to avoid issues with Vue's reactivity system.
 * This is because the Adyen SDK is not reactive and does not update when the props change. So keep
 * these variables as plain objects and don't store it in a ref. They are typed as any, since
 * no types are exposed. Since we're dynamically importing the Adyen SDK for code splitting,
 * we can't use the return types either.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dropInInstance: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let checkoutInstance: any | null = null;

const props = withDefaults(defineProps<PaymentIntegrationFormAdyenProps>(), {
    validateOnSubmit: () => Promise.resolve(true),
});
const emit = defineEmits<PaymentIntegrationFormAdyenEmits>();
defineExpose({ submit });

const PAYMENT_GATEWAY_VARIANT_ADYEN = 'ADYEN';

const dropInContainerRef = ref();
const showPaymentSuccess = ref(false);
const integrationError = ref<Error>();

const logger = useLogger();
const { locale } = useIntl();

const { authorizePayment, getPaymentDetails } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();
const experimentalFeatures = useExperimentalFeature();

const showPayButton = computed(() => props.variant === 'TOKENIZE');

function submit() {
    try {
        dropInInstance?.submit();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
    }
}

async function getConfiguration(): Promise<{
    checkoutConfig: CoreConfiguration;
    dropInConfig: DropinConfiguration;
}> {
    const adyenAmount = transformToAdyenAmount(props.amount);
    const paymentMethods = experimentalFeatures?.value?.['express-checkout']
        ? filterOutExpressPaymentMethods(
              mapAdyenPaymentMethods(props.paymentMethodOptionResponseEntry),
          )
        : mapAdyenPaymentMethods(props.paymentMethodOptionResponseEntry);

    return {
        checkoutConfig: {
            amount: adyenAmount,
            clientKey: getAdyenClientKeyFromPaymentMethodOptionsResponse(
                props.paymentMethodOptionResponseEntry,
            ),
            environment: getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                props.paymentMethodOptionResponseEntry,
            ),
            locale,
            translations: getOverriddenTranslations(props.variant),
            countryCode: props.countryCode,
            analytics: { enabled: false },
            paymentMethodsResponse: { paymentMethods },
            onSubmit: handleOnSubmit,
            onAdditionalDetails: handleOnAdditionalDetails,
            onPaymentCompleted: handleOnPaymentCompleted,
            onPaymentFailed: handleOnPaymentFailed,
            onError: handleOnError,
            showPayButton: showPayButton.value,
        },
        dropInConfig: {
            disableFinalAnimation: true,
            paymentMethodsConfiguration: {
                card: {
                    hasHolderName: true,
                    holderNameRequired: true,
                    enableStoreDetails:
                        !props.forceStorePaymentMethod && props.variant === 'AUTHORIZE',
                },
                paypal: {
                    intent: adyenAmount.value > 0 ? 'authorize' : 'tokenize',
                    showPayButton: true,
                },
            },
            openFirstPaymentMethod: props.selected,
            onSelect: () => emit('select'),
            onReady: () => emit('ready'),
        },
    };
}

async function mountDropIn() {
    if (!dropInContainerRef.value) return;

    try {
        await unmountDropIn();

        // Dynamically import Adyen SDK to enable code splitting
        const adyenModule = await import('@adyen/adyen-web/auto');
        const { AdyenCheckout, Dropin } = adyenModule;

        const { checkoutConfig, dropInConfig } = await getConfiguration();

        checkoutInstance = await AdyenCheckout(checkoutConfig);

        dropInInstance = new Dropin(checkoutInstance, dropInConfig).mount(dropInContainerRef.value);

        injectStylesToShadowRoot();
    } catch (error) {
        logger.error(
            'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
            'Failed to mount Adyen web drop-in',
            { error },
        );
    }
}

async function unmountDropIn() {
    if (dropInInstance) {
        dropInInstance.unmount();
        dropInInstance = null;
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
        style.textContent = `${adyenCss}
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
                box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                transition: box-shadow 0.2s ease-in-out;
            }

            .adyen-checkout__payment-method--selected {
                box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            }

            .adyen-checkout__payment-method:after {
                transform: scale(0%);
            }

            .adyen-checkout__paypal__button {
                display: block !important;
            }

            .adyen-checkout__payment-methods-list {
                gap: 4px;
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
                background-color: var(--color-primary-600);
                position: absolute;
                top: 14px;
                right: 14px;
                text-align: center;
                line-height: 20px;
                color: white;
                transform: scale(100%);
                font-size: 12px;
            }

            .adyen-checkout__payment-method__header {
                padding: 8px 16px !important;
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

        if (props.variant === 'AUTHORIZE') {
            style.textContent += `
            .adyen-checkout__payment-method--cashapp .adyen-checkout-pm-details-wrapper {
                display: none;
            }
            `;
        }

        root.appendChild(style);
    }
}

function handleOnSubmit(
    ...args: Parameters<NonNullable<CoreConfiguration['onSubmit']>>
): ReturnType<NonNullable<CoreConfiguration['onSubmit']>> {
    const [state, _component, actions] = args;

    props
        .validateOnSubmit()
        .then((isValid) => {
            if (!isValid) {
                return;
            }

            const paymentAcceptorId = props.paymentMethodOptionResponseEntry.payment_acceptor.id;

            const adyen: AuthorizePaymentPayload['adyen'] = {
                risk_data: transformObjectToAdyenObject(state.data.riskData),
                payment_method: transformObjectToAdyenObject(state.data.paymentMethod),
                browser_info: transformObjectToAdyenObject(state.data.browserInfo),
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
                        store_payment_method:
                            props.forceStorePaymentMethod || state.data.storePaymentMethod,
                    },
                    amount: props.amount,
                    ...(props.context ? { context: props.context } : {}),
                    return_url: returnUrl,
                })
                    .then((paymentResult) => {
                        const paymentMethodType = state.data.paymentMethod.type;

                        if (['FAILURE', 'REFUSED'].includes(paymentResult.status)) {
                            logger.error(
                                'PAYMENT_AUTHORIZATION_FAILED',
                                `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                                { error: paymentResult },
                            );
                            actions.resolve({ resultCode: 'Error' });
                            return;
                        }

                        if (
                            paymentResult.status === 'ACTION_REQUIRED' &&
                            paymentResult.action.payment_gateway_variant ===
                                PAYMENT_GATEWAY_VARIANT_ADYEN
                        ) {
                            const requiredAction = handleActionRequiredPaymentAction(
                                paymentResult,
                                paymentMethodType,
                            );

                            if (!requiredAction) {
                                logger.error(
                                    'PAYMENT_AUTHORIZATION_FAILED',
                                    `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                                    { error: paymentResult },
                                );
                                return;
                            }

                            dropInInstance.handleAction(requiredAction);

                            actions.resolve({
                                resultCode: paymentResult.action.adyen.result_code,
                                action: requiredAction,
                            });
                            return;
                        }

                        showPaymentSuccess.value = true;
                        actions.resolve({ resultCode: 'Authorised' });
                    })
                    .catch((error) => {
                        logger.error(
                            'PAYMENT_AUTHORIZATION_FAILED',
                            `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                            { error },
                        );
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
                    logger.error(
                        'TOKENIZATION_FAILED',
                        `Missing customer id for payment acceptor with id ${paymentAcceptorId}`,
                    );
                    return;
                }

                tokenizePaymentMethod({
                    customer_id: props.customerId,
                    payment_acceptor_id: paymentAcceptorId,
                    payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
                    adyen,
                    return_url: returnUrl,
                })
                    .then((paymentResult) => {
                        const paymentMethodType = state.data.paymentMethod.type;

                        if (['FAILURE', 'REFUSED'].includes(paymentResult.status)) {
                            logger.error(
                                'TOKENIZATION_FAILED',
                                `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                                { error: paymentResult },
                            );
                            actions.resolve({ resultCode: 'Error' });
                            return;
                        }

                        if (
                            paymentResult.status === 'ACTION_REQUIRED' &&
                            paymentResult.action.payment_gateway_variant ===
                                PAYMENT_GATEWAY_VARIANT_ADYEN
                        ) {
                            const requiredAction = handleActionRequiredPaymentAction(
                                paymentResult,
                                paymentMethodType,
                            );

                            if (!requiredAction) {
                                logger.error(
                                    'TOKENIZATION_FAILED',
                                    `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                                    { error: paymentResult },
                                );
                                return;
                            }

                            dropInInstance.handleAction(requiredAction);

                            actions.resolve({
                                resultCode: paymentResult.action.adyen.result_code,
                                action: requiredAction,
                            });
                            return;
                        }

                        showPaymentSuccess.value = true;
                        actions.resolve({ resultCode: 'Authorised' });
                    })
                    .catch((error) => {
                        logger.error(
                            'TOKENIZATION_FAILED',
                            `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                            { error },
                        );
                        actions.resolve({ resultCode: 'Error' });
                    });
            }
        })
        .catch(() => {});
}

function handleActionRequiredPaymentAction(
    response: AuthorizePaymentResponse,
    paymentMethodType: string,
): PaymentAction | undefined {
    if (response.status !== 'ACTION_REQUIRED') {
        return undefined;
    }

    const action = response.action;
    if (action.payment_gateway_variant != 'ADYEN') {
        return undefined;
    }

    const adyenRequiredAction = action.adyen;
    return {
        paymentMethodType: adyenRequiredAction?.payment_method_type ?? paymentMethodType,
        method: action.method,
        url: action.url,
        data: action.data,
        type: adyenRequiredAction?.action_type,
        paymentData: adyenRequiredAction?.payment_data,
        sdkData: adyenRequiredAction?.sdk_data,
    };
}

function handleOnAdditionalDetails(
    ...args: Parameters<NonNullable<CoreConfiguration['onAdditionalDetails']>>
): ReturnType<NonNullable<CoreConfiguration['onAdditionalDetails']>> {
    const [state] = args;
    const detailsResult = state.data.details;
    const paymentDataResult = state.data.paymentData;

    if (props.paymentMethodOptionResponseEntry.payment_acceptor.id) {
        handlePaymentDetails({
            // For the moment: Adyen gives a null value back which is not accepted by Solvimon API, so filter that out
            detailsResult: detailsResult ? removeEmptyValues(detailsResult) : undefined,
            paymentDataResult,
            paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
        });
        return;
    }

    const error: Error = {
        code: 'UNKNOWN_ERROR',
        message: 'Payment failed',
        error: args,
    };
    emit('payment-failed', error);
    integrationError.value = error;
}

function removeEmptyValues(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== null && value !== undefined),
    );
}

function handleOnPaymentFailed(
    ...args: Parameters<NonNullable<CoreConfiguration['onPaymentFailed']>>
): ReturnType<NonNullable<CoreConfiguration['onPaymentFailed']>> {
    const [data] = args;
    const error: Error = {
        code: 'UNKNOWN_ERROR',
        message: 'Payment failed',
        error: data,
    };
    emit('payment-failed', error);
    integrationError.value = error;
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
    const [data, component] = args;

    if (data.name === 'CANCEL') {
        return;
    }

    const error: Error = {
        code: 'UNKNOWN_ERROR',
        message: 'Something went wrong',
        error: data,
    };
    logger.error('INTEGRATION_ERROR', 'Something went wrong', { error: data });
    integrationError.value = error;
    component?.unmount();
}

function handlePaymentDetails({
    detailsResult,
    threeDSResult,
    redirectResult,
    paymentDataResult,
    paymentAcceptorId,
}: {
    detailsResult?: Record<string, unknown>;
    /**
     * @deprecated replaced by sending along [details]
     */
    threeDSResult?: string;
    /**
     * @deprecated replaced by sending along [details]
     */
    redirectResult?: string;
    paymentDataResult?: string;
    paymentAcceptorId: PaymentAcceptor['id'];
}) {
    getPaymentDetails({
        paymentAcceptorId,
        paymentGatewayVariant: PAYMENT_GATEWAY_VARIANT_ADYEN,
        adyen: {
            ...(detailsResult ? { details: detailsResult } : {}),
            ...(redirectResult ? { redirect_result: redirectResult } : {}),
            ...(threeDSResult ? { threeds_result: threeDSResult } : {}),
            ...(paymentDataResult ? { payment_data: paymentDataResult } : {}),
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
            logger.error('PAYMENT_DETAILS_CALL_FAILED', 'Failed fetching payment details', {
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
        logger.error(
            'INVALID_REDIRECT_RESULT',
            'Redirect result is set but payment acceptor id is missing',
            { context: { redirectResult } },
        );
        return;
    }

    handlePaymentDetails({
        paymentAcceptorId,
        detailsResult: {
            redirectResult: decodeURI(redirectResult),
        },
    });
}

onMounted(() => {
    void mountDropIn();
    handleRedirectResult();
});

onBeforeUnmount(() => {
    void unmountDropIn();
});

// Re-mount when paymentMethodOptions change
watch(
    () => props.paymentMethodOptionResponseEntry,
    (newValue, oldValue) => {
        // Don't re-mount when payment method options are the same.
        if (isEqual(newValue, oldValue)) return;

        void mountDropIn();
    },
    { deep: true },
);
</script>

<template>
    <PaymentCompletedCard v-if="showPaymentSuccess" :variant="variant" />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" />
    <div ref="dropInContainerRef"></div>
</template>
