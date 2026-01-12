<script setup lang="ts">
import { Button, formatAmount, Section, Typography, useIntl, useTimePeriod } from '@solvimon/ui';
import { computed, onMounted, ref } from 'vue';
import type { Address, CountryCode } from '@solvimon/types';
import type { CheckoutEmits, CheckoutProps } from './Checkout.types';
import { useCheckoutView } from './useCheckoutView';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import Kpi from '@/components/shared/Kpi.vue';
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
import { useExperimentalFeature } from '@/components/providers/ExperimentalFeatureProvider/composables/useExperimentalFeature';
import { useLogger } from '@/components/providers';

const props = defineProps<CheckoutProps>();
const emit = defineEmits<CheckoutEmits>();

const criticalError = ref<Error>();
const paymentIntegrationFormRef = ref();

const logger = useLogger();
const { $t, locale } = useIntl();
const { formatTimePeriod } = useTimePeriod();
const portal = usePortal();
const experimentalFeatures = useExperimentalFeature();

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
    trialInvoicePreview,
    trialPeriod,
    authorizationContext,
    isPaid,
    amount,
    updateInvoicePreviewOnBillingInformationChange,
} = useCheckoutView({
    initialCountry: props.countryCode,
    initialEmail: props.email,
    subscriptionId,
    enabledPricingIds: props.enabledPricingIds,
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
                start_date: new Date(invoicePreview.value.periods[0].start_at),
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
            start_date: new Date(invoicePreview.value.periods[0].start_at),
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
                    startDate: new Date(trialInvoicePreview.value.periods[0].start_at),
                    endDate: new Date(trialInvoicePreview.value.periods[0].end_at),
                },
            }),
        regular: {
            label: subscriptionName,
            amount: invoicePreview.value.tax_summary.total_amount,
            startDate: new Date(invoicePreview.value.periods[0].start_at),
            interval: subscription.value?.billing_period ?? { type: 'MONTH', value: 1 },
        },
    };
});

const handleUpdateBillingInformation = (billingInformation: Partial<Address>) => {
    const { country, ...rest } = billingInformation;
    checkoutForm.updateInitialState({
        ...rest,
        ...(country ? { country: country as CountryCode } : {}),
    });
};

const showCustomerInfoOnTop = computed(() => !(props.email && props.countryCode));

const trialStartDate = computed<Date | undefined>(() => {
    return trialInvoicePreview.value?.periods[0].start_at
        ? new Date(trialInvoicePreview.value.periods[0].start_at)
        : undefined;
});

const subscriptionStartDate = computed<Date | undefined>(() => {
    return invoicePreview.value?.periods[0].start_at
        ? new Date(invoicePreview.value.periods[0].start_at)
        : undefined;
});

onMounted(() => {
    emit('ready');
});
</script>

<template>
    <CheckoutNotAvailable v-if="criticalError" />
    <template v-else>
        <Skeleton class="min-h-[52px] w-96">
            <CheckoutTitle
                v-if="invoicePreview && subscription && subscriptionStartDate"
                :trial-start-date="trialStartDate"
                :trial-period="trialPeriod"
                :subscription-start-date="subscriptionStartDate"
                :subscription-name="subscription?.name ?? ''"
                :amount="invoicePreview?.invoice_amount_including_tax"
                :billing-period="subscription?.billing_period"
                :country-code="checkoutForm.form.value.country"
            />
        </Skeleton>

        <OrderSummary
            v-if="subscription"
            :subscription="subscription"
            :invoice="invoicePreview"
            :trial-invoice="trialInvoicePreview"
            :enabled-pricing-ids="enabledPricingIds"
            :trial-period="trialPeriod"
            :avatar="avatar"
            :is-paid="isPaid"
            :is-usage-based="isUsageBased"
            :is-preview-and-payment-methods-pending="
                isPaymentMethodsPending || isInvoicePreviewPending
            "
            :country-code="checkoutForm.form.value.country"
            class="mt-4 md:hidden"
            collapsible="collapsed"
            no-title
        />

        <div class="flex flex-col grow gap-4 mt-4">
            <!-- content -->
            <div class="flex flex-col md:flex-row grow gap-6">
                <!-- left -->
                <div class="grow flex flex-col gap-4">
                    <ExpressPaymentMethods
                        v-if="
                            !isPaid &&
                            checkoutForm.form.value.country &&
                            amount &&
                            experimentalFeatures?.['express-checkout']
                        "
                        :amount="amount"
                        :country-code="checkoutForm.form.value.country"
                        :locale="locale"
                        :payment-methods-options-response="paymentMethodOptions ?? []"
                        :billing-information="expressPaymentMethodBillingInformation!"
                        :on-billing-information-change="
                            updateInvoicePreviewOnBillingInformationChange
                        "
                        @update-billing-information="handleUpdateBillingInformation"
                    />

                    <CheckoutForm
                        v-model="checkoutForm.form.value"
                        :validation="checkoutForm.validation"
                        :read-only-email="props.email"
                        :show-customer-info-on-top="showCustomerInfoOnTop || isPaid"
                        :is-billing-information-mandatory="isBillingInformationMandatory"
                        :get-is-field-required="checkoutForm.getIsFieldRequired"
                        :read-only="isPaid"
                    >
                        <SubscriptionPaymentCompletedCard
                            v-if="isPaid"
                            :redirect-url="successRedirectUrl"
                        />
                        <template v-else>
                            <Skeleton variant="section" class="min-h-[130px]">
                                <div v-if="!isPaymentMethodsPending && !isInvoicePreviewPending">
                                    <Typography variant="heading-3" tag="h2" class="mb-2">{{
                                        $t({
                                            defaultMessage: 'Payment method',
                                            id: 'checkout.payment_method_block.title',
                                            description:
                                                'The title of the payment method block in the checkout form',
                                        })
                                    }}</Typography>
                                    <EmptyStatePlaceholder
                                        v-if="!checkoutForm.form.value.country"
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
                                        v-else-if="paymentMethodOptions.length === 0"
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
                                    <PaymentIntegrationForm
                                        v-else-if="
                                            invoicePreview &&
                                            amount &&
                                            checkoutForm.form.value.country
                                        "
                                        ref="paymentIntegrationFormRef"
                                        :country-code="checkoutForm.form.value.country"
                                        :context="authorizationContext"
                                        :amount="amount"
                                        variant="AUTHORIZE"
                                        :payment-method-options="paymentMethodOptions ?? []"
                                        :success-redirect-url="successRedirectUrl"
                                        :validate-on-submit="handleValidateOnSubmit"
                                        force-store-payment-method
                                        @payment-success="isPaid = true"
                                        @ready="emit('ready')"
                                    />
                                </div>
                            </Skeleton>
                        </template>
                    </CheckoutForm>
                </div>

                <!-- right -->
                <div class="flex flex-col gap-2 w-full md:w-72">
                    <Skeleton variant="section" class="min-h-[220px]">
                        <OrderSummary
                            v-if="subscription && invoicePreview"
                            :subscription="subscription"
                            :invoice="invoicePreview"
                            :trial-invoice="trialInvoicePreview"
                            :enabled-pricing-ids="props.enabledPricingIds"
                            :trial-period="trialPeriod"
                            :country-code="checkoutForm.form.value.country"
                            :avatar="avatar"
                            :is-paid="isPaid"
                            :is-usage-based="isUsageBased"
                            :is-preview-and-payment-methods-pending="
                                isPaymentMethodsPending || isInvoicePreviewPending
                            "
                        />
                    </Skeleton>

                    <Skeleton v-if="!isPaid" class="min-h-[44px]">
                        <Button
                            v-if="invoicePreview && !isInvoicePreviewPending"
                            type="button"
                            size="lg"
                            class="full-width"
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
                    <Section
                        v-if="$slots['terms-and-conditions']"
                        :title="
                            $t({
                                defaultMessage: 'Terms and conditions',
                                id: 'checkout.terms_and_conditions_block.title',
                                description:
                                    'The title of the terms and conditions block in the checkout',
                            })
                        "
                    >
                        <Typography variant="body-sm" shade="lighter">
                            <slot name="terms-and-conditions" />
                        </Typography>
                    </Section>

                    <div class="flex gap-4 grow text-gray-400 justify-center">
                        <Kpi
                            icon="lock"
                            :kpi="
                                $t({
                                    defaultMessage: 'Secure and encrypted payments',
                                    id: 'checkout.kpi.encrypted_payments.label',
                                    description: 'The encrypted payments KPI shown in the checkout',
                                })
                            "
                        />
                    </div>
                </div>
            </div>
        </div>
    </template>
</template>
