<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { isValidCountryCode } from '@solvimon/solvimon-ui';
import type {
    BillingPeriod,
    AuthorizePaymentPayload,
    Address,
    CountryCode,
} from '@solvimon/solvimon-types';
import type { AddressData, ApplePayConfiguration } from '@adyen/adyen-web';
import type { ExpressPaymentMethodEmits } from './ExpressPaymentMethod.types';
import type { ExpressPaymentMethodApplePayProps } from './ExpressPaymentMethodApplePay.types';
import ExpressPaymentMethodButton from '@/components/payments/ExpressPaymentMethodButton/ExpressPaymentMethodButton.vue';
import {
    createReturnUrl,
    getAdyenExpressCheckoutConfiguration,
    transformObjectToAdyenObject,
} from '@/utils/adyen';
import { useLogger } from '@/components/providers';
import { createPaymentsService } from '@/services/payments';

const PAYMENT_GATEWAY_VARIANT_ADYEN = 'ADYEN';

const props = defineProps<ExpressPaymentMethodApplePayProps>();
const emit = defineEmits<ExpressPaymentMethodEmits>();

const applePayButtonRef = ref<HTMLDivElement>();

const logger = useLogger();
const { authorizePayment } = createPaymentsService();

const paymentAcceptorId = props.paymentMethodOptionsResponse.payment_acceptor.id;

const initApplePay = async () => {
    const { AdyenCheckout, ApplePay } = await import('@adyen/adyen-web');

    const checkout = await AdyenCheckout(
        getAdyenExpressCheckoutConfiguration({
            amount: props.amount,
            locale: props.locale,
            countryCode: props.countryCode,
            paymentMethodOptionResponse: props.paymentMethodOptionsResponse,
        }),
    );

    const applePay = new ApplePay(checkout, {
        isExpress: true,
        recurringPaymentRequest: {
            paymentDescription: props.billingInformation.description,
            billingAgreement: props.billingInformation.agreement,
            managementURL: 'https://www.google.com',

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
            const { invoicePreview, trialInvoicePreview } = await props.onBillingInformationChange({
                ...(event.paymentMethod.billingContact?.postalCode && {
                    postal_code: event.paymentMethod.billingContact.postalCode,
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
            logger.error('APPLE_PAY_ERROR', 'Apple Pay error', { error });
        },
        onAuthorized: async (data, actions) => {
            try {
                logger.info('APPLE_PAY_AUTHORIZED', 'Apple Pay authorized', { data });

                // Transform payment data from Apple Pay authorizedEvent
                // The authorizedEvent contains the payment data that needs to be sent to Adyen
                const authorizedEvent = data.authorizedEvent;

                logger.info('APPLE_PAY_EVENT_DATA', 'Apple Pay event data structure', {
                    eventData: authorizedEvent,
                    hasPaymentMethod: !!authorizedEvent.payment.token.paymentMethod,
                    hasBrowserInfo: !!authorizedEvent.payment.token.paymentData,
                    billingAddress: data.billingAddress,
                });

                // Extract billing information from multiple possible sources
                // Try to get it from the authorizedEvent paymentMethod first, then from data.billingAddress
                const billingContact = authorizedEvent.payment.billingContact;
                const billingAddress = data.billingAddress;

                if (billingContact) {
                    emit(
                        'update-billing-information',
                        getBillingInformationFromContact(billingContact),
                    );
                } else if (billingAddress) {
                    emit(
                        'update-billing-information',
                        getBillingInformationFromAddress(billingAddress),
                    );
                }

                const adyen: AuthorizePaymentPayload['adyen'] = {
                    payment_method: transformObjectToAdyenObject(
                        authorizedEvent.payment.token.paymentMethod,
                    ),
                    browser_info: transformObjectToAdyenObject(
                        authorizedEvent.payment.token.paymentData,
                    ),
                };

                logger.info('APPLE_PAY_ADYEN_PAYLOAD', 'Adyen payload prepared', { adyen });

                const returnUrl = createReturnUrl({
                    paymentAcceptorId,
                    redirectUrl: window.location.href,
                });

                logger.info('APPLE_PAY_CALLING_API', 'Calling authorizePayment API', {
                    paymentAcceptorId,
                    amount: props.amount,
                });

                // Call backend API to authorize payment
                const paymentResult = await authorizePayment({
                    payment_acceptor_id: paymentAcceptorId,
                    payment_gateway_variant: PAYMENT_GATEWAY_VARIANT_ADYEN,
                    adyen: {
                        ...adyen,
                        store_payment_method: true, // Required for recurring payments
                    },
                    amount: props.amount,
                    return_url: returnUrl,
                });

                logger.info('APPLE_PAY_API_RESPONSE', 'Payment API response received', {
                    status: paymentResult.status,
                    paymentResult,
                });

                if (paymentResult.status === 'FAILURE') {
                    logger.error('APPLE_PAY_AUTHORIZATION_FAILED', 'Payment authorization failed', {
                        error: paymentResult,
                    });
                    actions.reject();
                    return;
                }

                // Handle ACTION_REQUIRED if needed (e.g., 3DS)
                if (paymentResult.status === 'ACTION_REQUIRED') {
                    logger.warn('APPLE_PAY_ACTION_REQUIRED', 'Payment requires additional action', {
                        action: paymentResult.action,
                    });
                    // For Apple Pay express checkout, we might need to handle this differently
                    // For now, reject if action is required
                    actions.reject();
                    return;
                }

                // Success - resolve the payment
                logger.info('APPLE_PAY_SUCCESS', 'Apple Pay payment successful, resolving');
                actions.resolve();
            } catch (error) {
                logger.error('APPLE_PAY_AUTHORIZATION_FAILED', 'Apple Pay authorization failed', {
                    error,
                });
                actions.reject();
            }
        },
    });

    if (!applePayButtonRef.value) {
        // eslint-disable-next-line no-console
        console.warn('Apple Pay button not found');
        return;
    }

    try {
        await applePay.isAvailable();
        applePay.mount(applePayButtonRef.value);
        emit('ready');
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Apple Pay not available', e);
    }
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

const getBillingInformationFromContact = (
    contact: ApplePayJS.ApplePayPaymentContact,
): Partial<Address> => ({
    postal_code: contact.postalCode,
    city: contact.locality,
    country: contact.countryCode,
});

const getBillingInformationFromAddress = (address: Partial<AddressData>): Partial<Address> => ({
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

onMounted(() => {
    void initApplePay();
});
</script>

<template>
    <ExpressPaymentMethodButton v-if="isVisible" type="applepay" @click="handleClick" />
    <div class="absolute h-[1px] w-[1px] overflow-hidden opacity-0">
        <div ref="applePayButtonRef"></div>
    </div>
</template>
