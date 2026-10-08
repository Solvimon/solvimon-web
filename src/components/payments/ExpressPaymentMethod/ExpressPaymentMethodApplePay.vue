<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import type {
    BillingPeriod,
    AuthorizePaymentResponse,
    Address,
    CountryCode,
} from '@solvimon/solvimon-types';
import type {
    AddressData,
    ApplePayConfiguration,
    SubmitActions,
    SubmitData,
} from '@adyen/adyen-web';
import type { ExpressPaymentMethodEmits } from './ExpressPaymentMethod.types';
import type { ExpressPaymentMethodApplePayProps } from './ExpressPaymentMethodApplePay.types';
import { createExpressCheckout } from './useExpressPaymentMethod';
import ExpressPaymentMethodButton from '@/components/payments/ExpressPaymentMethodButton/ExpressPaymentMethodButton.vue';
import { createReturnUrl, transformObjectToAdyenObject } from '@/utils/adyen';
import { useLogger } from '@/components/providers';
import { createPaymentsService } from '@/services/payments';
import { loadAdyenSdk } from '@/utils/adyenSdk';
import { createPaymentFailureContext, type PaymentFailureParams } from '@/utils/paymentFailure';

const PAYMENT_GATEWAY_VARIANT_ADYEN = 'ADYEN';

const props = defineProps<ExpressPaymentMethodApplePayProps>();
const emit = defineEmits<ExpressPaymentMethodEmits>();

const applePayButtonRef = ref<HTMLDivElement>();

/** Held so the button can be taken down again, and rebuilt when what it charges changes. */
let applePayInstance: { unmount: () => unknown } | undefined;

/** Which setup is the current one. A rebuild invalidates whatever is still in flight. */
let currentSetup = 0;

const logger = useLogger();
const { authorizePayment } = createPaymentsService();

const paymentAcceptorId = props.paymentMethodOptionsResponse.payment_acceptor.id;

/** The context every failure in this button is logged with. */
function failureContext(params: Omit<PaymentFailureParams, 'gateway'>): Record<string, unknown> {
    return createPaymentFailureContext({
        gateway: 'ADYEN',
        paymentAcceptorId,
        paymentMethodType: 'applepay',
        ...params,
    });
}

/** A charge is only a payment once the gateway says the money moved. */
const isAuthorized = (paymentResult: AuthorizePaymentResponse) =>
    paymentResult.status === 'SUCCESS' && paymentResult.payment?.result === 'AUTHORIZED';

/**
 * Where the payment is made. Adyen calls this once `onAuthorized` resolves, with the Apple Pay
 * credential already formed into a payment method — building that by hand is what put the
 * encrypted token into `browser_info`.
 */
const handleSubmit = async (state: SubmitData, actions: SubmitActions) => {
    const fail = (error: Error) => {
        actions.reject();
        emit('payment-failed', error);
    };

    try {
        const paymentResult = await authorizePayment({
            payment_acceptor_id: paymentAcceptorId,
            payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
            adyen: {
                payment_method: transformObjectToAdyenObject(state.data.paymentMethod),
                ...(state.data.riskData && {
                    risk_data: transformObjectToAdyenObject(state.data.riskData),
                }),
                store_payment_method: true, // Required for recurring payments
            },
            amount: props.amount,
            ...(props.context ? { context: props.context } : {}),
            return_url: createReturnUrl({ paymentAcceptorId, redirectUrl: window.location.href }),
        });

        if (isAuthorized(paymentResult)) {
            actions.resolve({ resultCode: 'Authorised' });
            emit('payment-success');
            return;
        }

        // Anything else — REFUSED, FAILURE, or a 3DS action this flow cannot carry out inside the
        // Apple Pay sheet — is a payment that did not happen, and must not read as one.
        logger.error(
            'APPLE_PAY_AUTHORIZATION_FAILED',
            'Payment authorization failed',
            failureContext({
                reason: 'APPLE_PAY_AUTHORIZATION_REJECTED',
                extra: { paymentStatus: paymentResult.status },
            }),
        );
        fail(new Error(`Apple Pay payment was not authorized (${paymentResult.status})`));
    } catch (error) {
        logger.error(
            'APPLE_PAY_AUTHORIZATION_FAILED',
            'Apple Pay authorization failed',
            failureContext({ reason: 'APPLE_PAY_AUTHORIZATION_FAILED', cause: error }),
            error,
        );
        fail(error instanceof Error ? error : new Error('Apple Pay authorization failed'));
    }
};

const initApplePay = async () => {
    const setup = currentSetup;
    const { ApplePay } = await loadAdyenSdk();

    const checkout = await createExpressCheckout(props, logger, {
        onSubmit: (state, _component, actions) => void handleSubmit(state, actions),
    });

    const applePay = new ApplePay(checkout, {
        isExpress: true,
        recurringPaymentRequest: {
            paymentDescription: props.billingInformation.description,
            billingAgreement: props.billingInformation.agreement,
            managementURL: props.billingInformation.managementURL,

            // Trial
            ...(props.billingInformation.trial && {
                trialBilling: {
                    label: props.billingInformation.trial.label,
                    amount: props.billingInformation.trial.amount.quantity.toString(),
                    type: 'final',
                    paymentTiming: 'recurring',
                    recurringPaymentStartDate: props.billingInformation.trial.startDate,
                    recurringPaymentEndDate: props.billingInformation.trial.endDate,
                },
            }),

            // Regular
            ...(props.billingInformation.regular && {
                regularBilling: {
                    label: props.billingInformation.regular.label,
                    amount: props.billingInformation.regular.amount.quantity.toString(),
                    type: 'final',
                    paymentTiming: 'recurring',
                    recurringPaymentStartDate: props.billingInformation.regular.startDate,
                    ...getAppleIntervalConfigFromTimePeriod(
                        props.billingInformation.regular.interval ?? { type: 'MONTH', value: 1 },
                    ),
                },
            }),
        },
        requiredBillingContactFields: ['postalAddress'],
        requiredShippingContactFields: ['email'],
        onPaymentMethodSelected: async (resolve, _reject, event) => {
            // Load new invoice preview with updated billing information
            // Checkout form fields, not address fields: `postal_code` was dropped on the way in,
            // so the preview was re-priced without the postal code the tax depends on.
            const { invoicePreview, trialInvoicePreview } = await props.onBillingInformationChange({
                ...(event.paymentMethod.billingContact?.postalCode && {
                    postalCode: event.paymentMethod.billingContact.postalCode,
                }),
                ...(event.paymentMethod.billingContact?.locality && {
                    city: event.paymentMethod.billingContact.locality,
                }),
                ...(getCountryCode(event.paymentMethod.billingContact?.countryCode) && {
                    country: getCountryCode(event.paymentMethod.billingContact?.countryCode),
                }),
            });

            const newTotalAmount = trialInvoicePreview
                ? trialInvoicePreview.invoice_amount_including_tax.quantity.toString()
                : invoicePreview.invoice_amount_including_tax.quantity.toString();

            emit('update-billing-information', {
                postal_code: event.paymentMethod.billingContact?.postalCode,
                city: event.paymentMethod.billingContact?.locality,
                country: event.paymentMethod.billingContact?.countryCode,
            });

            resolve({
                newTotal: {
                    label: props.billingInformation.regular.label,
                    amount: newTotalAmount,
                    type: 'final',
                },
            });
        },
        onError: (error) => {
            logger.error(
                'APPLE_PAY_ERROR',
                'Apple Pay error',
                failureContext({ reason: 'APPLE_PAY_ERROR', cause: error }),
                error,
            );
        },
        /**
         * Resolving here is what starts Adyen's payment flow, which calls `onSubmit` above. The
         * charge is not made from this callback — the form is checked here instead, because a
         * rejection shows the customer an error in the sheet rather than taking their money for a
         * subscription the checkout cannot create.
         */
        onAuthorized: async (data, actions) => {
            try {
                const billingContact = data.authorizedEvent.payment?.billingContact;
                const address = billingContact
                    ? getBillingInformationFromContact(billingContact)
                    : data.billingAddress
                      ? getBillingInformationFromAddress(data.billingAddress)
                      : undefined;
                const email = data.authorizedEvent.payment?.shippingContact?.emailAddress;

                // What the sheet collected is what the checkout is then validated against: the
                // customer never fills the form in this flow, so checking it before handing the
                // address and email over would reject every express payment.
                if (address || email) {
                    emit('update-billing-information', { ...address, ...(email && { email }) });
                    await nextTick();
                }

                const isValid = (await props.validateOnSubmit?.()) ?? true;

                if (!isValid) {
                    logger.warn(
                        'APPLE_PAY_FORM_INCOMPLETE',
                        'Apple Pay authorization stopped: the checkout form is incomplete',
                        failureContext({ reason: 'APPLE_PAY_FORM_INVALID' }),
                    );
                    actions.reject();
                    emit('payment-failed', new Error('The checkout form is incomplete'));
                    return;
                }

                actions.resolve();
            } catch (error) {
                // Adyen waits on one of the two: without this the sheet hangs on the customer.
                logger.error(
                    'APPLE_PAY_AUTHORIZATION_FAILED',
                    'Apple Pay authorization failed',
                    failureContext({ reason: 'APPLE_PAY_AUTHORIZATION_FAILED', cause: error }),
                    error,
                );
                actions.reject();
                emit(
                    'payment-failed',
                    error instanceof Error ? error : new Error('Apple Pay authorization failed'),
                );
            }
        },
    });

    if (!applePayButtonRef.value) {
        logger.error('APPLE_PAY_ERROR', 'Apple Pay button ref not found');
        return;
    }

    try {
        await applePay.isAvailable();

        // A rebuild that started while this one was waiting owns the button now.
        if (setup !== currentSetup) {
            return;
        }

        applePay.mount(applePayButtonRef.value);
        applePayInstance = applePay;
        emit('ready');
    } catch (e) {
        logger.error('APPLE_PAY_ERROR', 'Apple Pay not available on this device', {}, e);

        // Nothing is mounted, so nothing should be offered: the button is otherwise left visible
        // and dead, and the block it sits in waits on a `ready` that is never coming.
        if (setup === currentSetup) {
            emit('unavailable');
        }
    }
};

const unmountApplePay = () => {
    currentSetup += 1;
    applePayInstance?.unmount();
    applePayInstance = undefined;
};

const getAppleIntervalConfigFromTimePeriod = (
    timePeriod: BillingPeriod,
):
    | {
          recurringPaymentIntervalUnit: NonNullable<
              NonNullable<ApplePayConfiguration['recurringPaymentRequest']>['regularBilling']
          >['recurringPaymentIntervalUnit'];
          recurringPaymentIntervalCount: NonNullable<
              NonNullable<ApplePayConfiguration['recurringPaymentRequest']>['regularBilling']
          >['recurringPaymentIntervalCount'];
      }
    | undefined => {
    if (!timePeriod.value) {
        return undefined;
    }

    let recurringPaymentIntervalCount = timePeriod.value ?? 1;
    let recurringPaymentIntervalUnit = timePeriod.type.toLowerCase();

    if (timePeriod.type === 'WEEK') {
        recurringPaymentIntervalUnit = 'day';
        recurringPaymentIntervalCount = timePeriod.value * 7;
    }

    if (
        recurringPaymentIntervalUnit === 'day' ||
        recurringPaymentIntervalUnit === 'month' ||
        recurringPaymentIntervalUnit === 'year' ||
        recurringPaymentIntervalUnit === 'hour' ||
        recurringPaymentIntervalUnit === 'minute'
    ) {
        return {
            recurringPaymentIntervalUnit,
            recurringPaymentIntervalCount,
        };
    }
    // Log unsupported time period unit
    return undefined;
};

/** The street and the state come along: they are what US and CA checkouts are validated on. */
const getBillingInformationFromContact = (
    contact: ApplePayJS.ApplePayPaymentContact,
): Partial<Address> => ({
    ...(contact.addressLines?.[0] && { line1: contact.addressLines[0] }),
    ...(contact.addressLines?.[1] && { line2: contact.addressLines[1] }),
    ...(contact.administrativeArea && { state: contact.administrativeArea }),
    postal_code: contact.postalCode,
    city: contact.locality,
    country: contact.countryCode,
});

const getBillingInformationFromAddress = (address: Partial<AddressData>): Partial<Address> => ({
    ...(address.street && { line1: address.street }),
    ...(address.houseNumberOrName && { line2: address.houseNumberOrName }),
    ...(address.stateOrProvince && { state: address.stateOrProvince }),
    postal_code: address.postalCode,
    city: address.city,
    country: address.country,
});

const getCountryCode = (countryCode: string | undefined): CountryCode | undefined => {
    return countryCode && isCountryCode(countryCode) ? countryCode : undefined;
};

const isCountryCode = (countryCode: string): countryCode is CountryCode => {
    return isValidCountryCode(countryCode);
};

const handleClick = () => {
    const applePayButton = applePayButtonRef.value?.querySelector('apple-pay-button');
    if (applePayButton) {
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        applePayButton.dispatchEvent(clickEvent);
    }
};

/** Nothing above may escape as an unhandled rejection in the host's page. */
const startApplePay = async () => {
    try {
        await initApplePay();
    } catch (error) {
        logger.error(
            'APPLE_PAY_ERROR',
            'Apple Pay could not be set up',
            failureContext({ reason: 'APPLE_PAY_SETUP_FAILED', cause: error }),
            error,
        );
    }
};

onMounted(() => {
    void startApplePay();
});

/**
 * The sheet states the amount and the recurring agreement, both fixed when the button is built, so
 * a promo code or a seat change would otherwise leave the customer authorizing yesterday's total.
 */
watch(
    // By value: `amount` is rebuilt by every invoice preview, and `onPaymentMethodSelected` asks
    // for one as the sheet opens — comparing objects would tear down the live session.
    () =>
        [props.amount.quantity, props.amount.currency, props.billingInformation.agreement].join(
            '|',
        ),
    () => {
        unmountApplePay();
        void startApplePay();
    },
);

onBeforeUnmount(unmountApplePay);
</script>

<template>
    <ExpressPaymentMethodButton v-if="isVisible" type="applepay" @click="handleClick" />
    <div class="absolute h-[1px] w-[1px] overflow-hidden opacity-0">
        <div ref="applePayButtonRef"></div>
    </div>
</template>
