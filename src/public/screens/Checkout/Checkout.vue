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
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import type { Address, BillingPeriod, CountryCode } from '@solvimon/solvimon-types';
import type { CheckoutEmits, CheckoutProps } from './Checkout.types';
import { useCheckoutView } from './useCheckout.view';
import { usePromotionCode } from '@/composables/usePromotionCode';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';

const PaymentIntegrationForm = defineAsyncComponent(
    () => import('@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue'),
);
import CheckoutForm from '@/components/customer/CheckoutForm/CheckoutForm.vue';
import CheckoutTitle from '@/components/checkout/CheckoutTitle.vue';
import { isInvoiceUsageBased } from '@/utils/invoice';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import type { Error } from '@/types/errors';
import SubscriptionPaymentCompletedCard from '@/components/payments/SubscriptionPaymentCompletedCard/SubscriptionPaymentCompletedCard.vue';
import OrderSummary from '@/components/subscriptions/OrderSummary.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import ExpressPaymentMethods from '@/components/payments/ExpressPaymentMethods/ExpressPaymentMethods.vue';
import { useLogger } from '@/components/providers';
import PlanCustomizationEditor from '@/components/subscriptions/PlanCustomizationForm/PlanCustomizationEditor.vue';
import {
    isSubscriptionWithAddonProducts,
    isSubscriptionWithEnabledPricings,
} from '@/utils/enabledPricings';
import {
    getFirstPricingPlanScheduleOfType,
    getPricingItemConfigMetaById,
} from '@/utils/pricingPlanSchedule';
import { getPricingCurrencyForCountry } from '@/utils/countryCurrency';
import { ContentWithAsideLayout } from '@/layouts';
import { useViewport } from '@/composables/useViewport';
import PromotionCodeSection from '@/components/checkout/PromotionCodeSection.vue';
import { getFallbackTrialAndSubscriptionStartAndEndDates } from '@/utils/subscription';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import { safeUrlRedirect } from '@/utils/url';

const props = defineProps<CheckoutProps>();
const emit = defineEmits<CheckoutEmits>();
const configuration = computed(() => props.configuration);

const criticalError = ref<Error>();
const paymentIntegrationFormRef = ref();

const logger = useLogger();
const { $t, locale } = useIntl();
const { formatTimePeriod } = useTimePeriod();
const portal = usePortal();
const { isMobileViewport } = useViewport();

logger.info('COMPONENT_INITIALIZED', 'Checkout component initialized');

if (portal.value?.type !== 'INIT_PRICING_PLAN_SUBSCRIPTION') {
    logger.error('INVALID_TOKEN', 'Invalid token');
    throw Error('Invalid token');
}

if (portal.value.status === 'REVOKED') {
    criticalError.value = {
        code: 'RESOURCE_REVOKED',
        message: `Portal url with resource id "${portal.value.id}" is revoked`,
    };

    logger.error('RESOURCE_REVOKED', `Portal url with resource id "${portal.value.id}" is revoked`);
}

const subscriptionId = portal.value?.init_pricing_plan_subscription?.pricing_plan_subscription_id;
const successRedirectUrl = portal.value?.init_pricing_plan_subscription?.success_url;

const {
    paymentMethodOptions,
    subscription,
    isPaymentMethodsPending,
    isInvoicePreviewPending,
    checkoutForm,
    invoicePreview,
    invoicePreviewByBillingPeriod,
    trialInvoicePreview,
    trialPeriod,
    authorizationContext,
    isPaid,
    amount,
    loadInvoicePreview,
    updateInvoicePreviewOnBillingInformationChange,
} = useCheckoutView({
    initialCountry: props.configuration?.countryCode,
    initialEmail: props.configuration?.email,
    subscriptionId,
    enabledPricingIds: props.configuration?.enabledPricingIds,
});

const handleSubmit = async () => {
    await checkoutForm.validation.value.$validate();

    if (checkoutForm.validation.value.$invalid) {
        return;
    }

    paymentIntegrationFormRef.value?.submit();
};

const handleValidateOnSubmit = async () => {
    await checkoutForm.validation.value.$validate();
    return !checkoutForm.validation.value.$invalid;
};

const hasTrialPeriod = computed(() => !!trialInvoicePreview.value);

const isUsageBased = computed(() =>
    invoicePreview.value ? isInvoiceUsageBased(invoicePreview.value) : false,
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

// Filter seat configs by the selected currency + billing period.
const seatConfigIdsForSelection = computed(() => {
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

// Only expose seat values that match the active currency + billing period, but keep all values in state.
const seatsValuesModel = computed({
    get: () => {
        const all = checkoutForm.form.value.seatsValues ?? [];
        const ids = seatConfigIdsForSelection.value;
        if (!ids.size) {
            return all;
        }
        return all.filter(({ pricing_item_config_id }) => ids.has(pricing_item_config_id));
    },
    set: (value) => {
        const current = checkoutForm.form.value.seatsValues ?? [];
        const ids = seatConfigIdsForSelection.value;
        if (!ids.size) {
            checkoutForm.form.value.seatsValues = value;
            return;
        }

        const filtered = current.filter(
            ({ pricing_item_config_id }) => !ids.has(pricing_item_config_id),
        );
        checkoutForm.form.value.seatsValues = filtered.concat(value);
    },
});

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
                    trialInvoicePreview.value.tax_summary.total_amount.quantity === '0.00'
                        ? $t({
                              defaultMessage: 'Free',
                              id: 'checkout.agreement.trial.free',
                              description: 'The free amount for the trial period',
                          })
                        : formatAmount(trialInvoicePreview.value.tax_summary.total_amount),
                trial_period: formatTimePeriod(trialPeriod.value!, { short: true }),
                subscription_amount: formatAmount(
                    invoicePreview.value?.tax_summary.total_amount ?? {
                        quantity: '0.00',
                        currency: 'EUR',
                    },
                ),
                billing_period: formatTimePeriod(
                    invoicePreview.value?.billing_period ?? { type: 'MONTH', value: 1 },
                    { short: true, singular: true, hideValueForExactPeriods: true },
                ),
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
            subscription_amount: invoicePreview.value?.tax_summary.total_amount
                ? formatAmount(invoicePreview.value?.tax_summary.total_amount)
                : '',
            billing_period: formatTimePeriod(
                invoicePreview.value?.billing_period ?? { type: 'MONTH', value: 1 },
                { short: true, singular: true, hideValueForExactPeriods: true },
            ),
            // @ts-expect-error formatjs does not support this type yet
            start_date: new Date(subscriptionStartDate.value),
        },
    );
});

const expressPaymentMethodBillingInformation = computed(() => {
    if (!invoicePreview.value) {
        return undefined;
    }

    const subscriptionName =
        subscription.value?.name ??
        subscription.value?.pricing_plan_schedule_infos?.at(-1)?.pricing_plan_version.pricing_plan
            ?.name ??
        'Subscription';

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
        regular: {
            label: subscriptionName,
            amount: invoicePreview.value.tax_summary.total_amount,
            startDate: subscriptionStartDate.value
                ? new Date(subscriptionStartDate.value)
                : undefined,
            interval: subscription.value?.billing_period ?? { type: 'MONTH', value: 1 },
        },
    };
});

const isCountryCode = (country: string): country is CountryCode => isValidCountryCode(country);

const handleUpdateBillingInformation = (billingInformation: Partial<Address>) => {
    const { country, ...rest } = billingInformation;
    checkoutForm.updateInitialState({
        ...rest,
        ...(country && isCountryCode(country) ? { country } : {}),
    });
};

const showCustomerInfoOnTop = computed(
    () => !(props.configuration?.email && props.configuration?.countryCode),
);

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

    // Check if the subscription contains pricing groups with selection constraint
    if (subscription.value && isSubscriptionWithEnabledPricings(subscription.value!)) {
        return true;
    }

    if (subscription.value && isSubscriptionWithAddonProducts(subscription.value!)) {
        return true;
    }

    return false;
});

const promotionCode = ref<string | null>(null);

const {
    applyPromotionCode,
    removePromotionCode,
    isPromotionCodePending,
    promotionCodeErrorMessage,
} = usePromotionCode({
    checkoutForm,
    updateInvoicePreviewOnBillingInformationChange,
    logger,
    formatErrorMessage: ({ action }) =>
        action === 'apply'
            ? $t({
                  defaultMessage: 'Promotion code could not be applied. Please try again.',
                  id: 'checkout.promotion_code.apply_failed',
                  description: 'Error message when applying a promotion code in checkout failed',
              })
            : $t({
                  defaultMessage: 'Promotion code could not be removed. Please try again.',
                  id: 'checkout.promotion_code.remove_failed',
                  description: 'Error message when removing a promotion code in checkout failed',
              }),
    onInvalidPromotionCode: () => {
        promotionCode.value = null;
    },
    onApplyError: () => {
        promotionCode.value = null;
    },
});

const handleRedirect = () => {
    if (!successRedirectUrl) return;
    safeUrlRedirect(successRedirectUrl);
};

const handlePaymentSuccess = () => {
    isPaid.value = true;
    promotionCodeErrorMessage.value = null;

    if (props.configuration?.onPaymentSuccess) {
        props.configuration.onPaymentSuccess();
        return;
    }

    if (successRedirectUrl) {
        handleRedirect();
        return;
    }
};

const handleBillingPeriodChange = (billingPeriod: BillingPeriod) => {
    if (!subscription.value) {
        return;
    }

    subscription.value = {
        ...subscription.value,
        billing_period: billingPeriod,
    };

    void loadInvoicePreview();
};

onMounted(() => {
    emit('ready');
});
</script>

<template>
    <CheckoutNotAvailable
        v-if="criticalError"
        class="sv-checkout sv-root sv-screen sv-checkout--error"
    />
    <ContentWithAsideLayout
        v-else
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
                        :billing-period="subscription?.billing_period"
                        :country-code="checkoutForm.form.value.country"
                    />
                </Skeleton>
            </div>
        </template>

        <!-- content -->
        <template #content>
            <OrderSummary
                v-if="subscription && isMobileViewport"
                class="sv-checkout__mobile-order-summary"
                :subscription="subscription"
                :invoice="invoicePreview"
                :invoice-preview-by-billing-period="invoicePreviewByBillingPeriod"
                :trial-invoice="trialInvoicePreview"
                :enabled-pricing-ids="enabledPricingIdsModel"
                :trial-period="trialPeriod"
                :avatar="configuration?.avatar"
                :is-paid="isPaid"
                :is-usage-based="isUsageBased"
                :is-preview-and-payment-methods-pending="
                    isPaymentMethodsPending || isInvoicePreviewPending
                "
                :country-code="checkoutForm.form.value.country"
                collapsible="collapsed"
                variant="products-inline"
                @billing-period-change="handleBillingPeriodChange"
            />

            <!-- plan customization -->
            <PlanCustomizationEditor
                v-if="showPlanCustomizationEditor && subscription"
                v-model:seats-values="seatsValuesModel"
                v-model:enabled-pricing-ids="enabledPricingIdsModel"
                class="sv-checkout__plan-customization"
                :subscription="subscription"
                :initial-seats-values="checkoutForm.initialState?.value.seatsValues"
                :billing-period="subscription.billing_period"
                :currency="activePricingCurrency"
            />

            <!-- express payment methods -->
            <ExpressPaymentMethods
                v-if="
                    !isPaid &&
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
                :on-billing-information-change="updateInvoicePreviewOnBillingInformationChange"
                @update-billing-information="handleUpdateBillingInformation"
            />

            <!-- payment success notification -->
            <SubscriptionPaymentCompletedCard
                v-if="isPaid"
                class="sv-checkout__completed-payment"
                @continue-to-merchant="handleRedirect"
            />

            <!-- customer information form -->
            <CheckoutForm
                v-if="!isPaid"
                v-model="checkoutForm.form.value"
                class="sv-checkout__customer-form"
                :validation="checkoutForm.validation"
                :read-only-email="props.configuration?.email"
                :show-customer-info-on-top="showCustomerInfoOnTop || isPaid"
                :is-billing-information-mandatory="isBillingInformationMandatory"
                :get-is-field-required="checkoutForm.getIsFieldRequired"
                :read-only="isPaid"
            />

            <!-- payment methods -->
            <div v-if="!isPaid" class="sv-checkout__payment-methods">
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
                            v-if="!checkoutForm.form.value.country"
                            class="sv-checkout__payment-methods-empty"
                            icon="captive_portal"
                        >
                            <template #title>
                                {{
                                    $t({
                                        defaultMessage: 'Select your billing country',
                                        id: 'checkout.payment_method_block.no_country_selected_title',
                                        description: 'The title shown when no country is selected',
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
                            <template #message>
                                {{
                                    $t({
                                        defaultMessage:
                                            'There are no available payment methods. Please contact support for more information.',
                                        id: 'checkout.payment_method_block.no_payment_methods_available_message',
                                        description:
                                            'The message shown when there are no available payment methods',
                                    })
                                }}
                            </template>
                        </EmptyStatePlaceholder>
                        <div
                            v-else-if="amount && checkoutForm.form.value.country"
                            class="sv-checkout__payment-form"
                        >
                            <PaymentIntegrationForm
                                ref="paymentIntegrationFormRef"
                                :country-code="checkoutForm.form.value.country"
                                :context="authorizationContext"
                                :amount="amount"
                                variant="AUTHORIZE"
                                :payment-method-options="paymentMethodOptions ?? []"
                                :validate-on-submit="handleValidateOnSubmit"
                                force-store-payment-method
                                @payment-success="handlePaymentSuccess"
                                @ready="emit('ready')"
                            />
                        </div>
                    </div>
                </Skeleton>
            </div>
        </template>

        <template #aside>
            <!-- order summary -->
            <div class="sv-checkout__order-summary">
                <Skeleton variant="section" class="min-h-[220px]">
                    <OrderSummary
                        v-if="subscription && invoicePreview"
                        :subscription="subscription"
                        :invoice="invoicePreview"
                        :invoice-preview-by-billing-period="invoicePreviewByBillingPeriod"
                        :trial-invoice="trialInvoicePreview"
                        :enabled-pricing-ids="enabledPricingIdsModel"
                        :trial-period="trialPeriod"
                        :country-code="checkoutForm.form.value.country"
                        :avatar="configuration?.avatar"
                        :is-paid="isPaid"
                        :is-usage-based="isUsageBased"
                        :is-preview-and-payment-methods-pending="
                            isPaymentMethodsPending || isInvoicePreviewPending
                        "
                        @billing-period-change="handleBillingPeriodChange"
                    />
                </Skeleton>
            </div>

            <!-- promotion code -->
            <PromotionCodeSection
                v-if="!isPaid"
                class="sv-checkout__promotion-code"
                :promotion-code="promotionCode"
                @update:applied-code="promotionCode = $event"
                @remove="removePromotionCode"
                @apply="applyPromotionCode"
            />
            <ErrorNotification
                v-if="promotionCodeErrorMessage"
                class="sv-checkout__promotion-error mt-2"
                :title="promotionCodeErrorMessage"
            />

            <!-- pay button-->
            <div class="flex flex-col gap-2">
                <Skeleton v-if="!isPaid" class="sv-checkout__submit-skeleton min-h-[44px]">
                    <Button
                        v-if="invoicePreview"
                        type="button"
                        size="lg"
                        class="sv-action sv-action--primary sv-action--full-width sv-checkout__submit w-full"
                        :disabled="isPromotionCodePending || paymentMethodOptions.length === 0"
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
            </div>
        </template>
    </ContentWithAsideLayout>
</template>
