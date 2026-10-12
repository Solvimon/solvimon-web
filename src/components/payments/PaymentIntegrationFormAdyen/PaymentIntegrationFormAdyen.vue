<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CoreConfiguration, DropinConfiguration, PaymentAction } from '@adyen/adyen-web';
import type {
    AuthorizePaymentPayload,
    AuthorizePaymentResponse,
    PaymentAcceptor,
} from '@solvimon/solvimon-types';
import { useIntl, isEqual } from '@solvimon/solvimon-ui';
import type {
    PaymentIntegrationFormAdyenEmits,
    PaymentIntegrationFormAdyenProps,
} from './PaymentIntegrationFormAdyen.types';
import {
    findSepaNoticeTarget,
    getOverriddenTranslations,
    hasLostSepaNotice,
} from './PaymentIntegrationFormAdyen.lib';
import SepaMandateNotice from './SepaMandateNotice.vue';
import PaymentCompletedCard from '@/components/payments/PaymentCompletedCard/PaymentCompletedCard.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import type { Error } from '@/types/errors';
import { createPaymentsService } from '@/services/payments';
import { createPaymentMethodsService } from '@/services/paymentMethods';
import {
    createReturnUrl,
    getAdyenClientKeyFromPaymentMethodOptionsResponse,
    getAdyenDropInPaymentMethods,
    getAdyenEnvironmentFromPaymentMethodOptionsResponse,
    transformObjectToAdyenObject,
} from '@/utils/adyen';
import { toMinorUnitAmount } from '@/utils/amount';
import { loadAdyenSdk } from '@/utils/adyenSdk';
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import { useLogger } from '@/components/providers';
import {
    getAuthorizeOutcome,
    getPaymentDetailsOutcome,
    isOutcomeUnknownAfterError,
} from '@/utils/paymentOutcome';
import {
    createPaymentFailureContext,
    createPaymentFailureError,
    type PaymentFailureParams,
} from '@/utils/paymentFailure';
import { clearPaymentRedirectParams, readAdyenRedirectReturn } from '@/utils/paymentRedirect';

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
    storePaymentMethod: undefined,
});
const emit = defineEmits<PaymentIntegrationFormAdyenEmits>();
defineExpose({ submit });

const PAYMENT_GATEWAY_VARIANT_ADYEN = 'ADYEN';

const dropInContainerRef = ref();
const sepaNoticeRef = ref<HTMLElement | null>(null);
const sepaNoticeTarget = ref<HTMLElement | null>(null);
let sepaObserver: MutationObserver | undefined;
const showPaymentSuccess = ref(false);
const integrationError = ref<Error>();
// Set once a payment is settled or may still go through, so the drop-in cannot take a second one.
let isDropInWithheld = false;
// Enter in a card field and a wallet's own button submit without the screen, so the screen's
// button can start a second payment alongside one already on its way.
let isSubmissionInFlight = false;
// A mount that is no longer the latest one stops at its next await, so two never both land.
let mountAttempt = 0;
// Kept until the gateway has answered for it, so a retry can ask again after a failed call.
let pendingRedirectResult: string | undefined;

const logger = useLogger();
const { locale } = useIntl();

const { authorizePayment, getPaymentDetails } = createPaymentsService();
const { tokenizePaymentMethod } = createPaymentMethodsService();
const experimentalFeatures = useExperimentalFeature();

// Express methods get buttons of their own when that feature is on, so the drop-in leaves them out.
const dropInPaymentMethods = computed(() =>
    getAdyenDropInPaymentMethods(props.paymentMethodOptionResponseEntry, {
        excludeExpressPaymentMethods: !!experimentalFeatures?.value?.['express-checkout'],
    }),
);

/**
 * A drop-in built from nothing mounts an empty container and only writes a line to the console, so
 * the customer is left staring at a void. Nothing is rendered here rather than an error: this
 * component knows only its own gateway, and the screen around it may still have a working one.
 */
const canMountDropIn = computed(() => dropInPaymentMethods.value.length > 0);

/** The context every failure in this form is logged with, filled in from what the form knows. */
function failureContext(params: Omit<PaymentFailureParams, 'gateway'>): Record<string, unknown> {
    return createPaymentFailureContext({
        gateway: PAYMENT_GATEWAY_VARIANT_ADYEN,
        paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
        variant: props.variant,
        invoiceId: props.invoiceId,
        customerId: props.customerId,
        ...params,
    });
}

/**
 * Every failure leaves through here, so the card the customer sees always carries the reference
 * they can quote back to support.
 */
function emitError(err: Omit<Error, 'reference'>) {
    isSubmissionInFlight = false;
    const failure = createPaymentFailureError(err);
    integrationError.value = failure;
    emit('payment-failed', failure);
}

function succeed() {
    isSubmissionInFlight = false;
    withholdDropIn();
    showPaymentSuccess.value = true;
    emit('payment-success');
}

/**
 * The drop-in is taken away rather than answered: every answer Adyen accepts ends in either its
 * success or its failure callback, and this is neither.
 */
function reportUnconfirmed(reason: string, extra: Record<string, unknown> = {}, cause?: unknown) {
    withholdDropIn();
    logger.warn(
        'PAYMENT_OUTCOME_UNCONFIRMED',
        'The payment outcome could not be confirmed yet',
        failureContext({ reason, extra, cause }),
        cause,
    );
    emitError({
        code: 'PAYMENT_OUTCOME_UNCONFIRMED',
        message: 'Payment could not be confirmed',
        error: cause,
    });
}

function withholdDropIn() {
    isDropInWithheld = true;
    void unmountDropIn();
}

function submit() {
    // The screen already waits on the payment in flight; its answer settles this click too.
    if (isSubmissionInFlight) return;

    if (!dropInInstance?.isValid) {
        // Drop-in validates only the open payment method; with none open it shows nothing.
        if (dropInInstance && !dropInInstance.activePaymentMethod) {
            emit('invalid', 'NO_PAYMENT_METHOD');
            return;
        }

        dropInInstance?.showValidation();
        emit('invalid');
        return;
    }

    try {
        dropInInstance.submit();
    } catch (error) {
        logger.error(
            'ADYEN_SUBMIT_FAILED',
            'Failed to submit Adyen drop-in',
            failureContext({ reason: 'ADYEN_SUBMIT_FAILED', cause: error }),
            error,
        );
        emitError({
            code: props.variant === 'TOKENIZE' ? 'TOKENIZE_FAILED' : 'AUTHORIZATION_FAILED',
            message: 'Failed to submit Adyen drop-in',
            error,
        });
    }
}

async function getConfiguration(): Promise<{
    checkoutConfig: CoreConfiguration;
    dropInConfig: DropinConfiguration;
}> {
    const adyenAmount = toMinorUnitAmount(props.amount);
    const paymentMethods = dropInPaymentMethods.value;

    return {
        checkoutConfig: {
            amount: adyenAmount,
            clientKey: getAdyenClientKeyFromPaymentMethodOptionsResponse(
                props.paymentMethodOptionResponseEntry,
            ),
            environment: getAdyenEnvironmentFromPaymentMethodOptionsResponse(
                props.paymentMethodOptionResponseEntry,
                logger,
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
            showPayButton: false,
        },
        dropInConfig: {
            disableFinalAnimation: true,
            paymentMethodsConfiguration: {
                card: {
                    hasHolderName: true,
                    holderNameRequired: true,
                    enableStoreDetails:
                        !props.forceStorePaymentMethod &&
                        props.storePaymentMethod === undefined &&
                        props.variant === 'AUTHORIZE',
                },
                paypal: {
                    intent: adyenAmount.value > 0 ? 'authorize' : 'tokenize',
                    showPayButton: true,
                },
            },
            openFirstPaymentMethod: props.selected,
            onSelect: ({ props: { type } }) => {
                if (!type) return;
                emit('select', { paymentMethodType: type, paymentGatewayVariant: 'ADYEN' });
            },
            onReady: () => emit('ready'),
        },
    };
}

/**
 * The Adyen SDK and its styles, loaded on demand so neither sits in the chunk a screen pulls in up
 * front. The SDK itself comes from `@/utils/adyenSdk`, which documents why it is the SDK's only
 * `import('@adyen/adyen-web')`.
 */
function loadAdyen() {
    return Promise.all([
        loadAdyenSdk(),
        import('@adyen/adyen-web/styles/adyen.css?inline').then((module) => module.default),
    ]);
}

async function mountDropIn() {
    const attempt = ++mountAttempt;
    const isSuperseded = () => attempt !== mountAttempt;

    if (isDropInWithheld) return;

    await unmountDropIn();

    // A fresh attempt supersedes whatever the last one failed with, so the card from it does not
    // stay on screen above a drop-in that has since mounted.
    integrationError.value = undefined;

    if (!canMountDropIn.value) {
        const { payment_acceptor: paymentAcceptor, integration } =
            props.paymentMethodOptionResponseEntry;

        logger.warn('PAYMENT_INTEGRATION_NOT_RENDERABLE', 'No Adyen payment methods to offer', {
            fingerprint: ['PAYMENT_INTEGRATION_NOT_RENDERABLE', paymentAcceptor.id],
            paymentAcceptorId: paymentAcceptor.id,
            integrationId: integration.id,
            ...(props.invoiceId ? { invoiceId: props.invoiceId } : {}),
        });
        return;
    }

    // The container renders only once there is something to put in it.
    await nextTick();

    if (isSuperseded() || !dropInContainerRef.value) return;

    try {
        const [adyen, adyenCss] = await loadAdyen();
        if (isSuperseded()) return;

        const { checkoutConfig, dropInConfig } = await getConfiguration();

        const checkout = await adyen.AdyenCheckout(checkoutConfig);
        if (isSuperseded() || isDropInWithheld || !dropInContainerRef.value) return;

        checkoutInstance = checkout;

        dropInInstance = new adyen.Dropin(checkoutInstance, {
            ...dropInConfig,
            paymentMethodComponents: adyen.dropInPaymentMethodComponents,
        }).mount(dropInContainerRef.value);

        injectStylesToShadowRoot(adyenCss);
        observeSepaNotice();
    } catch (error) {
        if (isSuperseded()) return;

        logger.error(
            'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
            'Failed to mount Adyen web drop-in',
            failureContext({ reason: 'ADYEN_DROP_IN_MOUNT_FAILED', cause: error }),
            error,
        );
        emitError({
            code: 'PAYMENT_INTEGRATION_INITIALIZATION_FAILED',
            message: 'Failed to mount Adyen web drop-in',
            error,
        });
    }
}

/**
 * Keeps the mandate notice inside Adyen's SEPA card.
 *
 * Runs on every mutation of the drop-in, which is how it catches both the customer selecting SEPA
 * and Adyen re-creating the card underneath us. Setting the same target again is a no-op for Vue,
 * so the observer settles rather than looping on its own writes.
 */
function syncSepaNotice() {
    const target = findSepaNoticeTarget(dropInContainerRef.value);

    if (hasLostSepaNotice(target, sepaNoticeRef.value)) {
        sepaNoticeTarget.value = null;
        void nextTick(() => (sepaNoticeTarget.value = target));
        return;
    }

    sepaNoticeTarget.value = target;
}

function observeSepaNotice() {
    sepaObserver?.disconnect();

    if (!dropInContainerRef.value) return;

    sepaObserver = new MutationObserver(() => syncSepaNotice());
    sepaObserver.observe(dropInContainerRef.value, { childList: true, subtree: true });
    syncSepaNotice();
}

function stopObservingSepaNotice() {
    sepaObserver?.disconnect();
    sepaObserver = undefined;
    sepaNoticeTarget.value = null;
}

async function unmountDropIn() {
    stopObservingSepaNotice();

    if (dropInInstance) {
        dropInInstance.unmount();
        dropInInstance = null;
    }
    if (dropInContainerRef.value) {
        dropInContainerRef.value.innerHTML = '';
    }
}

const ADYEN_STYLE_ATTRIBUTE = 'data-sv-adyen-styles';

/** Every form in a shadow root shares its styles, so each goes in once however often it remounts. */
function appendStyleOnce(root: ShadowRoot, name: string, css: string) {
    if (root.querySelector(`style[${ADYEN_STYLE_ATTRIBUTE}="${name}"]`)) return;

    const style = document.createElement('style');
    style.setAttribute(ADYEN_STYLE_ATTRIBUTE, name);
    style.textContent = css;
    root.appendChild(style);
}

function injectStylesToShadowRoot(adyenCss: string) {
    const root = dropInContainerRef.value?.getRootNode();
    if (root instanceof ShadowRoot) {
        appendStyleOnce(root, 'sdk', adyenCss);

        // Inject custom overrides as an inline style
        appendStyleOnce(
            root,
            'overrides',
            `
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
        `,
        );

        if (props.variant === 'AUTHORIZE') {
            appendStyleOnce(
                root,
                'authorize',
                `
            .adyen-checkout__payment-method--cashapp .adyen-checkout-pm-details-wrapper {
                display: none;
            }
            `,
            );
        }
    }
}

type SubmitActions = Parameters<NonNullable<CoreConfiguration['onSubmit']>>[2];
type AdditionalDetailsActions = Parameters<
    NonNullable<CoreConfiguration['onAdditionalDetails']>
>[2];

/**
 * Turns an authorize or tokenize response into the drop-in's next step. Both take the same three
 * paths; only what they call the failure differs, which is why the caller logs it.
 */
function applyPaymentResult(
    paymentResult: AuthorizePaymentResponse,
    {
        paymentMethodType,
        actions,
        logFailure,
    }: {
        paymentMethodType: string;
        actions: SubmitActions;
        logFailure: (error: unknown) => void;
    },
): void {
    if (
        paymentResult.status === 'ACTION_REQUIRED' &&
        paymentResult.action.payment_gateway_variant === PAYMENT_GATEWAY_VARIANT_ADYEN
    ) {
        const requiredAction = handleActionRequiredPaymentAction(paymentResult, paymentMethodType);

        if (!requiredAction) {
            logFailure(paymentResult);
            return;
        }

        // Resolving with the action is what hands it to the drop-in; handing it over as well ran
        // the 3DS challenge twice.
        actions.resolve({
            resultCode: paymentResult.action.adyen.result_code,
            action: requiredAction,
        });
        return;
    }

    const outcome = getAuthorizeOutcome(paymentResult);

    if (outcome === 'SUCCEEDED') {
        showPaymentSuccess.value = true;
        actions.resolve({ resultCode: 'Authorised' });
        return;
    }

    if (outcome === 'UNCONFIRMED') {
        reportUnconfirmed('PAYMENT_PENDING', {
            paymentStatus: paymentResult.status,
            paymentResult: paymentResult.payment?.result,
            paymentMethodType,
        });
        return;
    }

    logFailure(paymentResult);
    actions.resolve({ resultCode: 'Error' });
}

function handleOnSubmit(
    ...args: Parameters<NonNullable<CoreConfiguration['onSubmit']>>
): ReturnType<NonNullable<CoreConfiguration['onSubmit']>> {
    const [state, _component, actions] = args;

    if (isSubmissionInFlight) return;
    isSubmissionInFlight = true;

    props
        .validateOnSubmit()
        .then((isValid) => {
            if (!isValid) {
                isSubmissionInFlight = false;
                dropInInstance?.setStatus('ready');
                emit('invalid');
                return;
            }

            emit('submitting');

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
                            props.storePaymentMethod ??
                            (props.forceStorePaymentMethod || state.data.storePaymentMethod),
                    },
                    amount: props.amount,
                    ...(props.context ? { context: props.context } : {}),
                    return_url: returnUrl,
                })
                    .then((paymentResult) =>
                        applyPaymentResult(paymentResult, {
                            paymentMethodType: state.data.paymentMethod.type,
                            actions,
                            logFailure: (error) =>
                                logger.error(
                                    'PAYMENT_AUTHORIZATION_FAILED',
                                    `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                                    failureContext({
                                        reason: 'PAYMENT_AUTHORIZATION_REJECTED',
                                        paymentMethodType: state.data.paymentMethod.type,
                                        cause: error,
                                    }),
                                    error,
                                ),
                        }),
                    )
                    .catch((error) => {
                        logger.error(
                            'PAYMENT_AUTHORIZATION_FAILED',
                            `Failed payment authorization for payment acceptor with id ${paymentAcceptorId}`,
                            failureContext({
                                reason: 'PAYMENT_AUTHORIZATION_FAILED',
                                paymentMethodType: state.data.paymentMethod.type,
                                cause: error,
                            }),
                            error,
                        );

                        if (isOutcomeUnknownAfterError(error)) {
                            reportUnconfirmed(
                                'PAYMENT_AUTHORIZATION_UNANSWERED',
                                { paymentMethodType: state.data.paymentMethod.type },
                                error,
                            );
                            return;
                        }

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
                        failureContext({ reason: 'TOKENIZATION_FAILED_NO_CUSTOMER' }),
                    );
                    // Returning quietly used to leave the customer looking at a form that had
                    // already taken their details and would never do anything with them.
                    emitError({ code: 'TOKENIZE_FAILED', message: 'Missing customer id' });
                    return;
                }

                tokenizePaymentMethod({
                    customer_id: props.customerId,
                    payment_acceptor_id: paymentAcceptorId,
                    payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
                    adyen,
                    return_url: returnUrl,
                })
                    .then((paymentResult) =>
                        applyPaymentResult(paymentResult, {
                            paymentMethodType: state.data.paymentMethod.type,
                            actions,
                            logFailure: (error) =>
                                logger.error(
                                    'TOKENIZATION_FAILED',
                                    `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                                    failureContext({
                                        reason: 'TOKENIZATION_REJECTED',
                                        paymentMethodType: state.data.paymentMethod.type,
                                        cause: error,
                                    }),
                                    error,
                                ),
                        }),
                    )
                    .catch((error) => {
                        logger.error(
                            'TOKENIZATION_FAILED',
                            `Tokenization failed for payment acceptor with id ${paymentAcceptorId}`,
                            failureContext({
                                reason: 'TOKENIZATION_FAILED',
                                paymentMethodType: state.data.paymentMethod.type,
                                cause: error,
                            }),
                            error,
                        );
                        actions.resolve({ resultCode: 'Error' });
                    });
            }
        })
        .catch((error) => {
            logger.error(
                'INTEGRATION_ERROR',
                'Unhandled error in payment submission flow',
                failureContext({ reason: 'ADYEN_SUBMISSION_FLOW_FAILED', cause: error }),
                error,
            );
            // Only what runs before the payment call can land here; that call has its own catch.
            isSubmissionInFlight = false;
            dropInInstance?.setStatus('ready');
            emit('invalid');
        });
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
    const [state, , actions] = args;
    const detailsResult = state.data.details;
    const paymentDataResult = state.data.paymentData;

    if (props.paymentMethodOptionResponseEntry.payment_acceptor.id) {
        void handlePaymentDetails({
            // For the moment: Adyen gives a null value back which is not accepted by Solvimon API, so filter that out
            detailsResult: detailsResult ? removeEmptyValues(detailsResult) : undefined,
            paymentDataResult,
            paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
            actions,
        });
        return;
    }

    logger.error(
        'PAYMENT_ACCEPTOR_MISSING',
        'Additional details arrived without a payment acceptor id',
        failureContext({ reason: 'PAYMENT_ACCEPTOR_MISSING' }),
    );
    emitError({
        code: 'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING',
        message: 'Payment failed',
        error: args,
    });
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

    // The drop-in reporting a failed payment is the single most common way a customer ends up on
    // the error card, and until now it was the one path that emitted nothing at all.
    logger.error(
        'ADYEN_PAYMENT_FAILED',
        'Adyen reported the payment as failed',
        failureContext({
            reason: 'ADYEN_PAYMENT_FAILED',
            extra: { resultCode: data?.resultCode },
        }),
        data,
    );
    emitError({ code: 'AUTHORIZATION_FAILED', message: 'Payment failed', error: data });
}

function handleOnPaymentCompleted(
    ...args: Parameters<NonNullable<CoreConfiguration['onPaymentCompleted']>>
): ReturnType<NonNullable<CoreConfiguration['onPaymentCompleted']>> {
    const [, component] = args;
    component?.unmount();
    succeed();
}

function handleOnError(
    ...args: Parameters<NonNullable<CoreConfiguration['onError']>>
): ReturnType<NonNullable<CoreConfiguration['onError']>> {
    const [data, component] = args;

    // The customer closed a wallet's sheet or popup: nothing was paid, and the screen waits on us.
    if (data.name === 'CANCEL') {
        isSubmissionInFlight = false;
        emit('invalid');
        return;
    }

    logger.error(
        'INTEGRATION_ERROR',
        'The Adyen drop-in reported an error',
        failureContext({
            reason: 'ADYEN_INTEGRATION_ERROR',
            cause: data,
            extra: { adyenErrorName: data.name },
        }),
        data,
    );
    emitError({ code: 'UNKNOWN_ERROR', message: 'Something went wrong', error: data });
    component?.unmount();
}

/**
 * With `actions`, the drop-in is waiting on the answer and its own callbacks report it; without,
 * this is a redirect return and the outcome is reported here.
 */
function handlePaymentDetails({
    detailsResult,
    threeDSResult,
    redirectResult,
    paymentDataResult,
    paymentAcceptorId,
    actions,
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
    actions?: AdditionalDetailsActions;
}): Promise<void> {
    return getPaymentDetails({
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
            if (!actions) pendingRedirectResult = undefined;

            const outcome = getPaymentDetailsOutcome(result);

            if (outcome === 'SUCCEEDED') {
                if (actions) {
                    actions.resolve({ resultCode: 'Authorised' });
                } else {
                    succeed();
                }
                return;
            }

            if (outcome === 'UNCONFIRMED') {
                reportUnconfirmed('PAYMENT_DETAILS_UNCONFIRMED', {
                    paymentStatus: result.payment_status,
                });
                return;
            }

            // The call went through; the payment it reports on did not. Worth its own code,
            // because nothing is wrong with the integration here.
            logger.error(
                'PAYMENT_DETAILS_REJECTED',
                'Payment details returned a failed payment',
                failureContext({
                    reason: 'PAYMENT_DETAILS_REJECTED',
                    paymentAcceptorId,
                    extra: { paymentStatus: result.payment_status },
                }),
            );

            if (actions) {
                actions.resolve({ resultCode: 'Refused' });
                return;
            }

            emitError({
                code: 'AUTHORIZATION_FAILED',
                message: 'Failed getting payment details',
                error: result,
            });
        })
        .catch((error) => {
            logger.error(
                'PAYMENT_DETAILS_CALL_FAILED',
                'Failed fetching payment details',
                failureContext({
                    reason: 'PAYMENT_DETAILS_CALL_FAILED',
                    paymentAcceptorId,
                    cause: error,
                }),
                error,
            );

            if (actions) {
                reportUnconfirmed('PAYMENT_DETAILS_CALL_FAILED', {}, error);
                return;
            }

            // The card's retry sends the same redirect result again, so it checks once more rather
            // than paying again.
            withholdDropIn();
            emitError({
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
async function handleRedirectResult() {
    const redirectReturn = readAdyenRedirectReturn(
        props.paymentMethodOptionResponseEntry.payment_acceptor.id,
    );

    if (!redirectReturn) {
        return;
    }

    // Handled once: a reload or a remount must not hand the gateway a spent result again.
    clearPaymentRedirectParams();

    if (redirectReturn.kind === 'MISSING_PAYMENT_ACCEPTOR') {
        logger.error(
            'INVALID_REDIRECT_RESULT',
            'Redirect result is set but payment acceptor id is missing',
            failureContext({ reason: 'INVALID_REDIRECT_RESULT' }),
        );
        emitError({
            code: 'REDIRECT_RESULT_PAYMENT_ACCEPTOR_MISSING',
            message: 'Redirect result is set but payment acceptor id is missing',
        });
        return;
    }

    if (redirectReturn.kind === 'INVALID') {
        reportUnconfirmed('INVALID_REDIRECT_RESULT');
        return;
    }

    pendingRedirectResult = redirectReturn.redirectResult;
    await confirmRedirectResult();
}

async function confirmRedirectResult() {
    if (!pendingRedirectResult) return;

    await handlePaymentDetails({
        paymentAcceptorId: props.paymentMethodOptionResponseEntry.payment_acceptor.id,
        detailsResult: { redirectResult: pendingRedirectResult },
    });
}

/**
 * Mounting clears the card of a previous attempt, but the returned payment is this attempt, and
 * what happened to it matters more to the customer than a drop-in that would not load. A rebuild
 * that overtook this mount has cleared it on purpose, so it stays cleared then.
 */
async function mountDropInKeepingRedirectCard() {
    const redirectError = integrationError.value;
    // `mountDropIn` takes the next attempt the moment it is called.
    const attempt = mountAttempt + 1;
    await mountDropIn();
    if (redirectError && attempt === mountAttempt) integrationError.value = redirectError;
}

/** "Try again" on the error card: starts the form over without reloading the page. */
async function retry() {
    integrationError.value = undefined;

    if (!pendingRedirectResult) {
        await mountDropIn();
        return;
    }

    isDropInWithheld = false;
    await confirmRedirectResult();
    await mountDropInKeepingRedirectCard();
}

onMounted(async () => {
    // The drop-in waits for the payment the customer came back from, so it cannot be paid twice.
    await handleRedirectResult();
    await mountDropInKeepingRedirectCard();
});

onBeforeUnmount(() => {
    mountAttempt++;
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
    <PaymentCompletedCard
        v-if="showPaymentSuccess"
        :variant="variant"
        :redirecting="redirectsOnSuccess"
    />
    <PaymentErrorCard v-else-if="integrationError" :error="integrationError" @retry="retry" />
    <div v-if="canMountDropIn" ref="dropInContainerRef"></div>

    <!-- Adyen's SEPA card has no slot of its own, so the notice is placed into it. -->
    <Teleport v-if="sepaNoticeTarget" :to="sepaNoticeTarget">
        <!-- Reffed on an element, not the component: the re-attach check needs a real node. -->
        <div ref="sepaNoticeRef">
            <SepaMandateNotice :billing-entity-name="billingEntityName" />
        </div>
    </Teleport>
</template>
