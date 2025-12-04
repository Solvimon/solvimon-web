<script setup lang="ts">
import { Button, InvoicePreview, Section, Typography, useIntl } from '@solvimon/ui';
import { computed, ref } from 'vue';
import type { CheckoutProps } from './Checkout.types';
import { useCheckoutView } from './useCheckoutView';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import PaymentIntegrationFormPlaceholder from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.placeholder.vue';
import Kpi from '@/components/shared/Kpi.vue';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import CheckoutForm from '@/components/customer/CheckoutForm/CheckoutForm.vue';
import CheckoutTitle from '@/components/checkout/CheckoutTitle.vue';
import { isInvoiceUsageBased } from '@/utils/invoice';
import CheckoutNotAvailable from '@/components/checkout/CheckoutNotAvailable.vue';
import type { Error } from '@/types/errors';
import { trackSentryException } from '@/utils/errorTracking';
import SubscriptionPaymentCompletedCard from '@/components/payments/SubscriptionPaymentCompletedCard/SubscriptionPaymentCompletedCard.vue';

const props = defineProps<CheckoutProps>();

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
    isPending: isPreviewAndPaymentMethodsPending,
    subscription,
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
</script>

<template>
    <CheckoutNotAvailable v-if="criticalError" />
    <template v-else>
        <CheckoutTitle
            v-if="invoicePreview && subscription"
            :trial-period="trialPeriod"
            :subscription-name="subscription?.name ?? ''"
            :amount="invoicePreview?.invoice_amount_including_tax"
            :billing-period="subscription?.billing_period"
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
                        <Typography variant="heading-3" tag="h2" class="mb-2">{{
                            $t({
                                defaultMessage: 'Payment method',
                                id: 'checkout.payment_method_block.title',
                                description:
                                    'The title of the payment method block in the checkout form',
                            })
                        }}</Typography>
                        <SubscriptionPaymentCompletedCard
                            v-if="isPaid"
                            :redirect-url="successRedirectUrl"
                        />
                        <template v-else>
                            <Typography
                                v-if="!checkoutForm.form.value.country"
                                variant="body-xs"
                                shade="lighter"
                                >{{
                                    $t({
                                        defaultMessage:
                                            'Payment methods will be shown after you select a country',
                                        id: 'checkout.payment_method_block.payment_methods_not_loaded_message',
                                        description:
                                            "The messages shown when no country is selected thus the payment methods can't be shown",
                                    })
                                }}</Typography
                            >
                            <PaymentIntegrationFormPlaceholder
                                v-else-if="isPreviewAndPaymentMethodsPending"
                            />
                            <PaymentIntegrationForm
                                v-else-if="invoicePreview && amount"
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
                            />
                        </template>
                    </CheckoutForm>
                </div>

                <!-- right -->
                <div class="flex flex-col gap-2 w-full md:w-72">
                    <Section
                        no-border
                        no-spacing
                        content-background="none"
                        :title="
                            $t({
                                defaultMessage: 'Order summary',
                                id: 'checkout.order_summary_block.title',
                                description:
                                    'The title of the order summary block that lists the subscription cost in the checkout',
                            })
                        "
                    >
                        <div class="grid grid-cols-1 gap-1">
                            <!-- subscription summary -->
                            <Section no-spacing>
                                <SubscriptionSummary
                                    v-if="subscription"
                                    :avatar="avatar"
                                    :invoice="invoicePreview"
                                    :subscription="subscription"
                                    :enabled-pricing-ids="props.enabledPricingIds"
                                    :loading="isPreviewAndPaymentMethodsPending"
                                    :trial-period="trialPeriod"
                                />
                            </Section>

                            <!-- usage based -->
                            <Section v-if="isUsageBased" no-spacing>
                                <div class="px-3 py-2">
                                    <Typography no-spacing variant="body-sm" shade="lighter">
                                        {{
                                            $t({
                                                defaultMessage: '+ Usage',
                                                id: 'checkout.invoice_preview.usage_based_message',
                                                description:
                                                    'The message shown for the usage based invoice preview',
                                            })
                                        }}
                                    </Typography>
                                </div>
                            </Section>

                            <!-- invoice preview -->
                            <Section>
                                <InvoicePreview
                                    v-if="invoicePreview"
                                    :invoice="invoicePreview"
                                    :trial-invoice="trialInvoicePreview"
                                    :variant="trialInvoicePreview ? 'without-products' : 'default'"
                                    :is-paid="isPaid"
                                    is-customer-facing
                                />
                                <Typography v-else variant="body-sm" shade="lighter"
                                    >{{
                                        $t({
                                            defaultMessage: 'Please select a country first',
                                            description:
                                                'The message shown for the invoice preview when no country is set',
                                            id: 'checkout.invoice_preview.no_country_selected_message',
                                        })
                                    }}
                                </Typography>
                            </Section>
                        </div>
                    </Section>
                    <Button
                        v-if="!isPaid"
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
