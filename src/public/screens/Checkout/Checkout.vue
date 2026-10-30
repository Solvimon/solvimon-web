<script setup lang="ts">
import {
    Button,
    ErrorNotification,
    formatAmount,
    isValidCountryCode,
    Typography,
    useIntl,
    useTimePeriod,
} from '@solvimon/solvimon-ui';
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue';
import type { Amount, AuthorizePaymentPayload, CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutEmits, CheckoutProps } from './Checkout.types';
import type { CheckoutSource } from './Checkout.source.types';
import type { ExpressBillingInformation } from '@/components/payments/ExpressPaymentMethod/ExpressPaymentMethod.types';
import CheckoutForm from '@/components/customer/CheckoutForm/CheckoutForm.vue';
import CheckoutTitle from '@/components/checkout/CheckoutTitle.vue';
import { isInvoiceUsageBased } from '@/utils/invoice';
import SubscriptionPaymentCompletedCard from '@/components/payments/SubscriptionPaymentCompletedCard/SubscriptionPaymentCompletedCard.vue';
import OrderSummary from '@/components/subscriptions/OrderSummary.vue';
import MarkdownText from '@/components/shared/MarkdownText/MarkdownText.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import ExpressPaymentMethods from '@/components/payments/ExpressPaymentMethods/ExpressPaymentMethods.vue';
import { useLogger } from '@/components/providers';
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import {
    isSubscriptionWithAddonProducts,
    isSubscriptionWithEnabledPricings,
} from '@/utils/enabledPricings';
import {
    getFirstPricingPlanScheduleOfType,
    getPricingItemConfigMetaById,
} from '@/utils/pricingPlanSchedule';
import { getPricingCurrencyForCountry } from '@/utils/countryCurrency';
import { getModelTypesFromScheduleInfo } from '@/utils/pricing';
import { ContentWithAsideLayout } from '@/layouts';
import { useViewport } from '@/composables/useViewport';
import { usePaymentFormHold } from '@/composables/usePaymentFormHold';
import PromotionCodeSection from '@/components/checkout/PromotionCodeSection.vue';
import {
    getFallbackTrialAndSubscriptionStartAndEndDates,
    getSubscriptionName,
} from '@/utils/subscription';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import { safeUrlRedirect } from '@/utils/url';

const PaymentIntegrationForm = defineAsyncComponent(
    () => import('@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue'),
);

/**
 * Loaded on demand, like the payment form above. It renders behind a subscription that has yet to
 * arrive, so importing it eagerly only bought the checkout weight it had to carry before it could
 * show anything.
 *
 * Its two neighbours behind the same kind of condition — the completed card and the unavailable
 * notice — were measured and left alone: together they came to under 320 bytes, which does not pay
 * for a request of their own.
 */
const PlanCustomizationEditor = defineAsyncComponent(
    () => import('@/components/subscriptions/PlanCustomizationForm/PlanCustomizationEditor.vue'),
);

const props = defineProps<CheckoutProps & { source: CheckoutSource }>();
const emit = defineEmits<CheckoutEmits>();
const configuration = computed(() => props.configuration);

const paymentIntegrationFormRef = ref();

const logger = useLogger();
const { $t, locale } = useIntl();
const { formatTimePeriod } = useTimePeriod();
const { isMobileViewport } = useViewport();

// Trimmed so a note of only whitespace renders nothing rather than an empty gap in the column.
const termsAndConditions = computed(() => props.source.note.value?.trim() || undefined);

const {
    validatedEmail,
    validatedCountry,
    subscription,
    orderMeterValues,
    isInvoicePreviewPending,
    isInvoicePreviewStale,
    settleInvoicePreview,
    checkoutForm,
    invoicePreview,
    invoicePreviewByBillingPeriod,
    trialInvoicePreview,
    trialPeriod,
    payment,
    isPaid,
    amount,
    recurringAmount,
    hasOneOffCharges,
    changeBillingPeriod,
    saveFormStateForRedirect,
    clearSavedFormState,
    successUrl: successRedirectUrl,
    isShippingAddressRequired,
} = props.source;

const paymentMethodOptions = computed(() => payment?.paymentMethodOptions.value ?? []);
const isPaymentMethodsPending = computed(() => payment?.isPaymentMethodsPending.value ?? false);
const hasPaymentMethodOptionsError = computed(
    () => payment?.hasPaymentMethodOptionsError.value ?? false,
);
const authorizationContext = computed(() => payment?.authorizationContext.value);
const retryPaymentMethodOptions = () => payment?.retryPaymentMethodOptions();
const canPay = computed(() => !!payment && (props.source.canPay?.value ?? true));

const experimentalFeatures = useExperimentalFeature();
const isExpressCheckoutEnabled = computed(
    () => !!experimentalFeatures?.value?.['express-checkout'],
);

const isPaymentPending = ref(false);
const { isFormHeld, handleActionRequired } = usePaymentFormHold(isPaymentPending);

const handleSubmit = async () => {
    await checkoutForm.validation.value.$validate();

    // Without a mounted form nothing would ever answer the submit and end the pending state.
    if (checkoutForm.validation.value.$invalid || !paymentIntegrationFormRef.value) {
        return;
    }

    handlePaymentSubmitting();
    paymentIntegrationFormRef.value.submit();
};

/** Also reached when the form submits on its own, so it may redirect away just the same. */
const handlePaymentSubmitting = () => {
    isPaymentPending.value = true;
    paymentErrorMessage.value = null;
    saveFormStateForRedirect?.();
};

const paymentErrorMessage = ref<string | null>(null);

// Both kinds reach this: the card form reports the SDK's own `Error`, an express sheet a plain
// one. Only the message is read, so the handler asks for no more than that.
/** The gateway would not submit. It shows the customer what is missing, so nothing is said here. */
const handlePaymentNotSubmitted = () => {
    isPaymentPending.value = false;
    paymentOrder.value = undefined;
    clearSavedFormState?.();
};

/** The payment may still go through, so paying again could charge the customer twice. */
const isPaymentUnconfirmed = ref(false);

const handlePaymentFailed = (error?: { message?: string; code?: string }) => {
    isPaymentPending.value = false;
    paymentOrder.value = undefined;
    clearSavedFormState?.();

    if (error?.code === 'PAYMENT_OUTCOME_UNCONFIRMED') {
        isPaymentUnconfirmed.value = true;
        return;
    }

    // The card form shows its own failure inside the drop-in; an express sheet closes with nothing
    // on screen unless the checkout says something itself.
    paymentErrorMessage.value =
        error?.message ??
        $t({
            defaultMessage: 'The payment did not go through. Please try again.',
            id: 'checkout.payment_failed',
            description: 'Error shown when a payment the customer started did not complete',
        });
};

/** The sheet closes with nothing on screen, so an unconfirmed outcome is explained here. */
const handleExpressPaymentFailed = (error?: { message?: string; code?: string }) => {
    handlePaymentFailed(error);

    if (error?.code === 'PAYMENT_OUTCOME_UNCONFIRMED') {
        paymentErrorMessage.value = $t({
            defaultMessage:
                'Your payment could not be confirmed yet and may still go through, so please do not pay again.',
            id: 'checkout.payment_unconfirmed',
            description:
                'Shown when it is not yet known whether an express payment the customer made went through',
        });
    }
};

/**
 * The amount and the order a card payment is sent for, fixed once its price has settled: the form
 * reads them when the gateway hands its token back, and the order stays locked until then, so the
 * two always come from the same moment.
 */
const paymentOrder = ref<{ amount: Amount; context: AuthorizePaymentPayload['context'] }>();
const orderLockAttrs = computed(() => (paymentOrder.value ? { inert: true } : {}));

// Every way to pay comes through here (the button, Enter in a card field, an express sheet), so
// none of them authorizes an amount the preview is about to replace.
const handleValidateOnSubmit = async () => {
    await checkoutForm.validation.value.$validate();
    if (checkoutForm.validation.value.$invalid) return false;

    const settlement = await settleInvoicePreview();
    if (settlement === 'CHANGED') {
        paymentErrorMessage.value = $t({
            defaultMessage: 'The price changed with your last edit. Check it and pay again.',
            id: 'checkout.price_changed',
            description:
                'Shown when a payment is held back because the customer changed the order while it waited for the price',
        });
        return false;
    }
    if (settlement === 'FAILED') {
        paymentErrorMessage.value = $t({
            defaultMessage: 'The price could not be brought up to date. Please try again.',
            id: 'checkout.price_not_settled',
            description:
                'Error shown when a payment is held back because the price of the latest changes could not be loaded',
        });
        return false;
    }

    if (amount.value) {
        paymentOrder.value = { amount: amount.value, context: authorizationContext.value };
        await nextTick();
    }
    return true;
};

const hasTrialPeriod = computed(() => !!trialInvoicePreview.value);

const planModelTypes = computed(() =>
    getModelTypesFromScheduleInfo(scheduleInfo.value, {
        enabledPricingIds: checkoutForm.form.value.enabledPricingIds,
    }),
);

const hasRecurringPricing = computed(() =>
    [...planModelTypes.value].some((modelType) => modelType !== 'ONE_OFF'),
);

const hasUsagePricing = computed(() => planModelTypes.value.has('USAGE_BASED'));

// Asked of the plan: usage puts no line on an invoice until some is reported, and at checkout
// none has been, for anybody. The invoice still answers for a plan this cannot read through.
const isUsageBased = computed(
    () =>
        hasUsagePricing.value ||
        (invoicePreview.value ? isInvoiceUsageBased(invoicePreview.value) : false),
);

/**
 * The invoice total stands in where the two could not be told apart. It overstates — it still
 * holds the one-off — but a mandate for more than will be charged is the safer of the two errors,
 * and leaving a subscription without one is not an option. Reported, since nothing on screen says
 * the figure is a stand-in.
 */
const mandateRecurringAmount = computed(
    () => recurringAmount.value ?? invoicePreview.value?.tax_summary.total_amount,
);

watch(
    () => hasOneOffCharges.value && !recurringAmount.value && !!invoicePreview.value,
    (isStandingIn) => {
        if (isStandingIn) {
            logger.warn(
                'RECURRING_AMOUNT_UNRESOLVED',
                'Could not tell the recurring part of the invoice from the one-off part; the mandate states the invoice total',
                { flow: 'CHECKOUT' },
            );
        }
    },
);

// Not just "the recurring amount is not zero": a usage-billed plan renews at zero on its first
// invoice and renews all the same, and dropping its mandate would be the worse of the two bugs.
const hasRecurringCharge = computed(
    () =>
        hasRecurringPricing.value ||
        (!!mandateRecurringAmount.value && Number(mandateRecurringAmount.value.quantity) !== 0),
);

const titleRecurringAmount = computed(() =>
    hasOneOffCharges.value ? recurringAmount.value : undefined,
);

const isBillingInformationMandatory = computed(
    () =>
        (checkoutForm.form.value.country &&
            ['US', 'CA'].includes(checkoutForm.form.value.country)) ||
        false,
);

const enabledPricingIdsModel = computed({
    get: () => checkoutForm.form.value.enabledPricingIds ?? [],
    set: (value) => {
        checkoutForm.form.value.enabledPricingIds = value;
    },
});

// Pick the DEFAULT schedule once so all lookups use the same schedule.
const scheduleInfo = computed(() =>
    subscription.value
        ? getFirstPricingPlanScheduleOfType({
              pricingPlanScheduleInfos: subscription.value.pricing_plan_schedule_infos,
              type: 'DEFAULT',
          })
        : undefined,
);

// Use country → pricing currency mapping to decide which seat configs to show.
const activePricingCurrency = computed(() => {
    if (!subscription.value) {
        return undefined;
    }
    const pricingCurrencySettings =
        scheduleInfo.value?.pricing_plan_version?.pricing_currency_settings;
    return getPricingCurrencyForCountry({
        country: checkoutForm.form.value.country,
        pricingCurrencySettings,
        fallbackCurrency: subscription.value.billing_currency,
    });
});

// Filter seat/units configs by the selected currency + billing period.
const configIdsForSelection = computed(() => {
    if (!scheduleInfo.value || !subscription.value) {
        return new Set<string>();
    }

    const pricingItemConfigById = getPricingItemConfigMetaById({
        pricingPlanScheduleInfo: scheduleInfo.value,
    });
    const targetCurrency = activePricingCurrency.value;
    const targetPeriod = subscription.value.billing_period;
    const ids = new Set<string>();

    pricingItemConfigById.forEach((configMeta, id) => {
        if (targetCurrency && configMeta.currency !== targetCurrency) {
            return;
        }
        if (
            targetPeriod &&
            configMeta.billingPeriod &&
            (configMeta.billingPeriod.type !== targetPeriod.type ||
                configMeta.billingPeriod.value !== targetPeriod.value)
        ) {
            return;
        }
        ids.add(id);
    });

    return ids;
});

// Only expose values that match the active currency + billing period, but keep all values in state.
const meterValuesModel = (key: 'seatsValues' | 'unitsValues') =>
    computed({
        get: () => {
            const all = checkoutForm.form.value[key] ?? [];
            const ids = configIdsForSelection.value;
            if (!ids.size) {
                return all;
            }
            return all.filter(({ pricing_item_config_id }) => ids.has(pricing_item_config_id));
        },
        set: (value) => {
            const current = checkoutForm.form.value[key] ?? [];
            const ids = configIdsForSelection.value;
            if (!ids.size) {
                checkoutForm.form.value[key] = value;
                return;
            }

            const filtered = current.filter(
                ({ pricing_item_config_id }) => !ids.has(pricing_item_config_id),
            );
            checkoutForm.form.value[key] = filtered.concat(value);
        },
    });
const seatsValuesModel = meterValuesModel('seatsValues');
const unitsValuesModel = meterValuesModel('unitsValues');

const agreementBillingPeriod = computed(() =>
    formatTimePeriod(invoicePreview.value?.billing_period ?? { type: 'MONTH', value: 1 }, {
        short: true,
        singular: true,
        hideValueForExactPeriods: true,
    }),
);

const agreement = computed(() => {
    if (trialInvoicePreview.value) {
        return $t(
            {
                defaultMessage:
                    '{discounted_amount} for {trial_period}, then {subscription_amount}/{billing_period} until canceled, starting {start_date, date, ::MMMMd}.',
                id: 'checkout.agreement.trial',
                description: 'The agreement for the trial period',
            },
            {
                discounted_amount:
                    Number(trialInvoicePreview.value.tax_summary.total_amount.quantity) === 0
                        ? $t({
                              defaultMessage: 'Free',
                              id: 'checkout.agreement.trial.free',
                              description: 'The free amount for the trial period',
                          })
                        : formatAmount(trialInvoicePreview.value.tax_summary.total_amount),
                trial_period: formatTimePeriod(trialPeriod.value!, { short: true }),
                subscription_amount: formatAmount(
                    mandateRecurringAmount.value ?? {
                        quantity: '0.00',
                        currency: trialInvoicePreview.value.tax_summary.total_amount.currency,
                    },
                ),
                billing_period: agreementBillingPeriod.value,
                // @ts-expect-error formatjs does not support this type yet
                start_date: new Date(subscriptionStartDate.value),
            },
        );
    }

    if (hasOneOffCharges.value && recurringAmount.value) {
        const dueToday = formatAmount(
            invoicePreview.value?.tax_summary.total_amount ?? {
                quantity: '0.00',
                currency: recurringAmount.value.currency,
            },
        );

        if (!hasRecurringCharge.value) {
            return $t(
                {
                    defaultMessage: '{due_today} today. One-time purchase.',
                    id: 'checkout.agreement.one_off',
                    description:
                        'The agreement for an order that is charged once and does not renew',
                },
                { due_today: dueToday },
            );
        }

        if (hasUsagePricing.value && Number(recurringAmount.value.quantity) === 0) {
            return $t(
                {
                    defaultMessage:
                        '{due_today} today, then usage billed every {billing_period} until canceled.',
                    id: 'checkout.agreement.usage_with_one_off',
                    description:
                        'The agreement for a usage-based subscription whose first invoice also charges something only once',
                },
                {
                    due_today: dueToday,
                    billing_period: agreementBillingPeriod.value,
                },
            );
        }

        return $t(
            {
                defaultMessage:
                    '{due_today} today, then {subscription_amount}/{billing_period} until canceled, starting {start_date, date, long}.',
                id: 'checkout.agreement.subscription_with_one_off',
                description:
                    'The agreement for a subscription whose first invoice also charges something only once',
            },
            {
                due_today: dueToday,
                subscription_amount: formatAmount(recurringAmount.value),
                billing_period: agreementBillingPeriod.value,
                // @ts-expect-error formatjs does not support this type yet
                start_date: new Date(subscriptionStartDate.value),
            },
        );
    }

    return $t(
        {
            defaultMessage:
                '{subscription_amount}/{billing_period} until canceled, starting {start_date, date, long}.',
            id: 'checkout.agreement.subscription',
            description: 'The agreement for the subscription',
        },
        {
            subscription_amount: mandateRecurringAmount.value
                ? formatAmount(mandateRecurringAmount.value)
                : '',
            billing_period: agreementBillingPeriod.value,
            // @ts-expect-error formatjs does not support this type yet
            start_date: new Date(subscriptionStartDate.value),
        },
    );
});

const orderSummaryProps = computed(() => ({
    invoicePreviewByBillingPeriod: invoicePreviewByBillingPeriod.value,
    trialInvoice: trialInvoicePreview.value,
    enabledPricingIds: enabledPricingIdsModel.value,
    countryCode: checkoutForm.form.value.country,
    avatar: configuration.value?.avatar,
    isPaid: isPaid.value,
    isUsageBased: isUsageBased.value,
}));

const expressPaymentMethodBillingInformation = computed(() => {
    if (!invoicePreview.value) {
        return undefined;
    }

    const subscriptionName = getSubscriptionName({
        subscription: subscription.value,
        fallback: $t({
            defaultMessage: 'Subscription',
            description: 'The fallback name for when no subscription name can be determined',
            id: 'customer_overview.subscriptions_block.fallback_subscription_name',
        }),
    });

    return {
        description: subscriptionName,
        managementURL: 'https://www.solvimon.com/account/billing',
        agreement: agreement.value,
        ...(trialInvoicePreview.value &&
            trialPeriod.value && {
                trial: {
                    label: $t({
                        defaultMessage: 'Trial',
                        id: 'checkout.trial.label',
                        description: 'The label of the trial',
                    }),
                    amount: trialInvoicePreview.value.tax_summary.total_amount,
                    startDate: trialStartDate.value ? new Date(trialStartDate.value) : undefined,
                    endDate: trialEndDate.value ? new Date(trialEndDate.value) : undefined,
                },
            }),
        // Left off entirely, so the sheet mandates no charge that is never going to be made.
        ...(hasRecurringCharge.value &&
            mandateRecurringAmount.value && {
                regular: {
                    label: subscriptionName,
                    amount: mandateRecurringAmount.value,
                    startDate: subscriptionStartDate.value
                        ? new Date(subscriptionStartDate.value)
                        : undefined,
                    interval: subscription.value?.billing_period ?? { type: 'MONTH', value: 1 },
                },
            }),
    };
});

const isCountryCode = (country: string): country is CountryCode => isValidCountryCode(country);

const handleUpdateBillingInformation = (billingInformation: ExpressBillingInformation) => {
    const { line1, line2, postal_code, city, state, country, email } = billingInformation;

    checkoutForm.updateInitialState({
        ...(line1 && { addressLine1: line1 }),
        ...(line2 && { addressLine2: line2 }),
        ...(postal_code && { postalCode: postal_code }),
        ...(city && { city }),
        ...(state && { state }),
        ...(email && { email }),
        ...(country && isCountryCode(country) ? { country } : {}),
    });
};

const showCustomerInfoOnTop = computed(() => !(validatedEmail && validatedCountry));

const trialStartDate = computed<Date | undefined>(() => {
    const firstPeriod = trialInvoicePreview.value?.periods?.[0];
    const fallback = fallbackSubscriptionDates.value?.trialStartDate;

    return firstPeriod?.start_at ? new Date(firstPeriod.start_at) : fallback;
});

const fallbackSubscriptionDates = computed(() => {
    return getFallbackTrialAndSubscriptionStartAndEndDates(subscription.value!);
});

const trialEndDate = computed<Date | undefined>(() => {
    const firstPeriod = trialInvoicePreview.value?.periods?.[0];
    const fallback = fallbackSubscriptionDates.value?.trialEndDate;

    return firstPeriod?.end_at ? new Date(firstPeriod.end_at) : fallback;
});

const subscriptionStartDate = computed<Date | undefined>(() => {
    const firstPeriod = invoicePreview.value?.periods?.[0];
    const fallback = fallbackSubscriptionDates.value?.subscriptionStartDate;

    return firstPeriod?.start_at ? new Date(firstPeriod.start_at) : fallback;
});

const showPlanCustomizationEditor = computed(() => {
    // Check if the subscription contains seats values
    if (checkoutForm.form.value.seatsValues && checkoutForm.form.value.seatsValues.length > 0) {
        return true;
    }

    // Check if the subscription contains one-off flat item unit values
    if (checkoutForm.form.value.unitsValues && checkoutForm.form.value.unitsValues.length > 0) {
        return true;
    }

    // Check if the subscription contains pricing groups with selection constraint
    if (subscription.value && isSubscriptionWithEnabledPricings(subscription.value!)) {
        return true;
    }

    if (subscription.value && isSubscriptionWithAddonProducts(subscription.value!)) {
        return true;
    }

    return false;
});

const {
    code: promotionCode,
    isPending: isPromotionCodePending,
    errorMessage: promotionCodeErrorMessage,
    apply: applyPromotionCode,
    remove: removePromotionCode,
} = props.source.promotionCode;
const isPromotionCodeAllowed = computed(() => props.source.promotionCode.isAllowed?.value ?? true);
const setPromotionCode = (code: string | null) => {
    promotionCode.value = code;
};

const handleRedirect = () => {
    if (!successRedirectUrl.value) return;
    safeUrlRedirect(successRedirectUrl.value);
};

/**
 * Whether a paid checkout leaves this page, which is what `handlePaymentSuccess` goes on to do.
 * A host that supplies `onPaymentSuccess` takes the flow over and may navigate itself, but that is
 * theirs to announce — all the success card can honestly promise is the redirect this screen does.
 */
const redirectsOnSuccess = computed(
    () => !props.configuration?.onPaymentSuccess && !!successRedirectUrl.value,
);

const handlePaymentSuccess = () => {
    isPaid.value = true;
    paymentOrder.value = undefined;
    clearSavedFormState?.();
    promotionCodeErrorMessage.value = null;
    paymentErrorMessage.value = null;

    if (props.configuration?.onPaymentSuccess) {
        props.configuration.onPaymentSuccess();
        return;
    }

    if (successRedirectUrl.value) {
        handleRedirect();
        return;
    }
};

onMounted(() => {
    emit('ready');
});
</script>

<template>
    <ContentWithAsideLayout
        class="sv-checkout sv-root sv-screen"
        :class="{ 'sv-checkout--paid': isPaid }"
    >
        <template #header>
            <div class="sv-checkout__header">
                <Skeleton class="min-h-[52px] w-96">
                    <CheckoutTitle
                        v-if="invoicePreview && subscription && subscriptionStartDate"
                        class="sv-checkout__title"
                        :trial-start-date="trialStartDate"
                        :trial-period="trialPeriod"
                        :subscription-start-date="subscriptionStartDate"
                        :subscription-name="subscription?.name ?? ''"
                        :amount="invoicePreview?.invoice_amount_including_tax"
                        :due-today-amount="amount ?? invoicePreview?.invoice_amount_including_tax"
                        :recurring-amount="titleRecurringAmount"
                        :has-one-off-charges="hasOneOffCharges"
                        :has-recurring-charge="hasRecurringCharge"
                        :has-usage-charges="hasUsagePricing"
                        :billing-period="subscription?.billing_period"
                        :country-code="checkoutForm.form.value.country"
                    />
                </Skeleton>
            </div>
        </template>

        <!-- content -->
        <template #content>
            <template v-if="isPaid">
                <SubscriptionPaymentCompletedCard class="sv-checkout__completed-payment" />
            </template>

            <template v-else>
                <!-- mobile order summary -->
                <OrderSummary
                    v-if="subscription && isMobileViewport"
                    class="sv-checkout__mobile-order-summary"
                    v-bind="orderSummaryProps"
                    :subscription="subscription"
                    :invoice="invoicePreview"
                    collapsible="collapsed"
                    variant="products-inline"
                    @billing-period-change="changeBillingPeriod"
                />

                <!-- plan customization -->
                <PlanCustomizationEditor
                    v-if="showPlanCustomizationEditor && subscription"
                    v-bind="orderLockAttrs"
                    v-model:seats-values="seatsValuesModel"
                    v-model:units-values="unitsValuesModel"
                    v-model:enabled-pricing-ids="enabledPricingIdsModel"
                    class="sv-checkout__plan-customization"
                    :subscription="subscription"
                    :initial-seats-values="orderMeterValues.seatsValues"
                    :initial-units-values="orderMeterValues.unitsValues"
                    :billing-period="subscription.billing_period"
                    :currency="activePricingCurrency"
                />

                <!-- express payment methods -->
                <ExpressPaymentMethods
                    v-if="
                        payment &&
                        isExpressCheckoutEnabled &&
                        !isPaymentUnconfirmed &&
                        checkoutForm.form.value.country &&
                        amount &&
                        expressPaymentMethodBillingInformation
                    "
                    class="sv-checkout__express-payment-methods"
                    :amount="amount"
                    :country-code="checkoutForm.form.value.country"
                    :locale="locale"
                    :payment-methods-options-response="paymentMethodOptions ?? []"
                    :billing-information="expressPaymentMethodBillingInformation"
                    :on-billing-information-change="
                        payment.updateInvoicePreviewOnBillingInformationChange
                    "
                    :context="authorizationContext"
                    :validate-on-submit="handleValidateOnSubmit"
                    @update-billing-information="handleUpdateBillingInformation"
                    @payment-success="handlePaymentSuccess"
                    @payment-failed="handleExpressPaymentFailed"
                />

                <!-- customer information form -->
                <CheckoutForm
                    v-model="checkoutForm.form.value"
                    class="sv-checkout__customer-form"
                    :validation="checkoutForm.validation"
                    :read-only-email="validatedEmail"
                    :show-customer-info-on-top="showCustomerInfoOnTop || isPaid"
                    :is-billing-information-mandatory="isBillingInformationMandatory"
                    :is-shipping-address-required="isShippingAddressRequired"
                    :get-is-field-required="checkoutForm.getIsFieldRequired"
                    :shipping-address-format="checkoutForm.shippingAddressFormat.value"
                    :read-only="isPaid"
                    v-bind="orderLockAttrs"
                />

                <!-- payment methods -->
                <div class="sv-checkout__payment-methods">
                    <Skeleton variant="section" class="min-h-[130px]">
                        <div
                            v-if="
                                !isPaymentMethodsPending ||
                                (isPaymentMethodsPending && paymentMethodOptions.length > 0)
                            "
                            class="sv-checkout__payment-methods-body"
                        >
                            <Typography
                                variant="heading-3"
                                tag="h2"
                                class="sv-checkout__payment-methods-title mb-2"
                                >{{
                                    $t({
                                        defaultMessage: 'Payment method',
                                        id: 'checkout.payment_method_block.title',
                                        description:
                                            'The title of the payment method block in the checkout form',
                                    })
                                }}</Typography
                            >
                            <EmptyStatePlaceholder
                                v-if="!payment"
                                class="sv-checkout__payment-unavailable"
                                icon="credit_card_off"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'Payment is not available yet',
                                            id: 'checkout.payment_method_block.payment_unavailable_title',
                                            description:
                                                'The title shown where the payment methods go when this checkout cannot take a payment yet',
                                        })
                                    }}
                                </template>
                            </EmptyStatePlaceholder>
                            <EmptyStatePlaceholder
                                v-else-if="!checkoutForm.form.value.country"
                                class="sv-checkout__payment-methods-empty"
                                icon="captive_portal"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'Select your billing country',
                                            id: 'checkout.payment_method_block.no_country_selected_title',
                                            description:
                                                'The title shown when no country is selected',
                                        })
                                    }}
                                </template>
                                <template #message>
                                    {{
                                        $t({
                                            defaultMessage:
                                                'Payment methods will be shown after you select the billing country.',
                                            id: 'checkout.payment_method_block.no_country_selected_message',
                                            description:
                                                'The message shown when no country is selected',
                                        })
                                    }}
                                </template>
                            </EmptyStatePlaceholder>
                            <EmptyStatePlaceholder
                                v-else-if="hasPaymentMethodOptionsError"
                                class="sv-checkout__payment-methods-error"
                                icon="error"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'Could not load payment methods',
                                            id: 'checkout.payment_method_block.load_failed_title',
                                            description:
                                                'The title shown when the payment methods failed to load',
                                        })
                                    }}
                                </template>
                                <template #message>
                                    {{
                                        $t({
                                            defaultMessage: 'Check your connection and try again.',
                                            id: 'checkout.payment_method_block.load_failed_message',
                                            description:
                                                'The message shown when the payment methods failed to load',
                                        })
                                    }}
                                </template>
                                <template #action>
                                    <Button
                                        type="button"
                                        intent="secondary"
                                        size="sm"
                                        class="sv-action sv-action--secondary sv-checkout__payment-methods-retry"
                                        @click="retryPaymentMethodOptions"
                                    >
                                        {{
                                            $t({
                                                defaultMessage: 'Try again',
                                                id: 'checkout.payment_method_block.load_failed_retry_button.label',
                                                description:
                                                    'The label of the button that loads the payment methods again',
                                            })
                                        }}
                                    </Button>
                                </template>
                            </EmptyStatePlaceholder>
                            <EmptyStatePlaceholder
                                v-else-if="paymentMethodOptions.length === 0"
                                class="sv-checkout__payment-methods-empty"
                                icon="credit_card_off"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'No payment methods available',
                                            id: 'checkout.payment_method_block.no_payment_methods_available_title',
                                            description:
                                                'The title shown when there are no available payment methods',
                                        })
                                    }}
                                </template>
                            </EmptyStatePlaceholder>
                            <div
                                v-else-if="amount && checkoutForm.form.value.country"
                                class="sv-checkout__payment-form"
                            >
                                <div :class="{ 'pointer-events-none opacity-60': isFormHeld }">
                                    <PaymentIntegrationForm
                                        ref="paymentIntegrationFormRef"
                                        :country-code="checkoutForm.form.value.country"
                                        :context="
                                            paymentOrder
                                                ? paymentOrder.context
                                                : authorizationContext
                                        "
                                        :amount="paymentOrder ? paymentOrder.amount : amount"
                                        :email="checkoutForm.form.value.email"
                                        variant="AUTHORIZE"
                                        :payment-method-options="paymentMethodOptions ?? []"
                                        :validate-on-submit="handleValidateOnSubmit"
                                        :redirects-on-success="redirectsOnSuccess"
                                        force-store-payment-method
                                        :billing-entity-name="
                                            subscription?.billing_entity?.legal_name
                                        "
                                        @payment-success="handlePaymentSuccess"
                                        @payment-failed="handlePaymentFailed"
                                        @invalid="handlePaymentNotSubmitted"
                                        @submitting="handlePaymentSubmitting"
                                        @action-required="handleActionRequired"
                                        @ready="emit('ready')"
                                    />
                                </div>
                            </div>
                        </div>
                    </Skeleton>
                </div>
            </template>
        </template>

        <template #aside>
            <!-- order summary -->
            <div class="sv-checkout__order-summary">
                <Skeleton variant="section" class="min-h-[220px]">
                    <OrderSummary
                        v-if="subscription && invoicePreview"
                        v-bind="orderSummaryProps"
                        :subscription="subscription"
                        :invoice="invoicePreview"
                        @billing-period-change="changeBillingPeriod"
                    />
                </Skeleton>
            </div>

            <template v-if="!isPaid">
                <!-- promotion code -->
                <PromotionCodeSection
                    v-if="isPromotionCodeAllowed"
                    class="sv-checkout__promotion-code"
                    v-bind="orderLockAttrs"
                    :promotion-code="promotionCode"
                    :is-pending="isPromotionCodePending"
                    @update:applied-code="setPromotionCode"
                    @remove="removePromotionCode"
                    @apply="applyPromotionCode"
                />
                <ErrorNotification
                    v-if="promotionCodeErrorMessage"
                    class="sv-checkout__promotion-error mt-2"
                    :title="promotionCodeErrorMessage"
                />

                <ErrorNotification
                    v-if="paymentErrorMessage"
                    class="sv-checkout__payment-error mt-2"
                    :title="paymentErrorMessage"
                />

                <!-- pay button-->
                <div class="flex flex-col gap-4">
                    <Skeleton class="sv-checkout__submit-skeleton min-h-10">
                        <Button
                            v-if="invoicePreview"
                            type="button"
                            size="md"
                            class="sv-action sv-action--primary sv-action--full-width sv-checkout__submit w-full"
                            :disabled="
                                !canPay ||
                                isPromotionCodePending ||
                                isInvoicePreviewPending ||
                                isInvoicePreviewStale ||
                                hasPaymentMethodOptionsError ||
                                paymentMethodOptions.length === 0 ||
                                isPaymentPending ||
                                isPaymentUnconfirmed
                            "
                            :loading="isPaymentPending"
                            @click="handleSubmit"
                        >
                            {{
                                hasTrialPeriod
                                    ? $t({
                                          defaultMessage: 'Start trial',
                                          id: 'checkout.pay_and_subscribe_button_trial.label',
                                          description:
                                              'The label of the start trial button in the checkout form',
                                      })
                                    : $t({
                                          defaultMessage: 'Pay and subscribe',
                                          id: 'checkout.pay_and_subscribe_button.label',
                                          description:
                                              'The label of the pay and subscribe button in the checkout form',
                                      })
                            }}
                        </Button>
                    </Skeleton>

                    <!-- kpis-->
                    <SecurePaymentsKPI :payment-method-options="paymentMethodOptions" />

                    <Typography
                        v-if="termsAndConditions"
                        tag="div"
                        variant="body-xs"
                        color="subtle"
                        class="sv-checkout__terms px-4 text-center"
                        data-testid="checkout-terms"
                    >
                        <MarkdownText :source="termsAndConditions" />
                    </Typography>
                </div>
            </template>
        </template>
    </ContentWithAsideLayout>
</template>
