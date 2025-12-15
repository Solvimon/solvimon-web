<script setup lang="ts">
import { Button, Section, Typography, useIntl } from '@solvimon/ui';
import { computed, onMounted, ref } from 'vue';
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
import { trackSentryException } from '@/utils/errorTracking';
import SubscriptionPaymentCompletedCard from '@/components/payments/SubscriptionPaymentCompletedCard/SubscriptionPaymentCompletedCard.vue';
import OrderSummary from '@/components/subscriptions/OrderSummary.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import Skeleton from '@/components/shared/Skeleton.vue';

const props = defineProps<CheckoutProps>();
const emit = defineEmits<CheckoutEmits>();

const criticalError = ref<Error>();
const paymentIntegrationFormRef = ref();

const { $t } = useIntl();
const portal = usePortal();

if (portal.value?.type !== 'INIT_PRICING_PLAN_SUBSCRIPTION') {
    throw Error('Invalid token');
}

if (portal.value.status === 'REVOKED') {
    criticalError.value = {
        code: 'RESOURCE_REVOKED',
        message: `Portal url with resource id "${portal.value.id}" is revoked`,
    };

    trackSentryException(criticalError.value);
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

const showCustomerInfoOnTop = computed(() => !(props.email && props.countryCode));

onMounted(() => {
    emit('ready');
});
</script>

<template>
    <CheckoutNotAvailable v-if="criticalError" />
    <template v-else>
        <Skeleton class="min-h-[52px] w-96">
            <CheckoutTitle
                v-if="invoicePreview && subscription"
                :trial-period="trialPeriod"
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
                                        @error="(error) => $emit('error', error)"
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

                    <Skeleton class="min-h-[44px]">
                        <Button
                            v-if="!isPaid && invoicePreview && !isInvoicePreviewPending"
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
