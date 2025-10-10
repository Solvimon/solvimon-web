<script setup lang="ts">
import { Button, InvoicePreview, Section, Typography, useIntl } from '@solvimon/ui';
import { computed, ref, watch } from 'vue';
import type { Address, AuthorizePaymentPayload, Name } from '@solvimon/types';
import type { CheckoutProps } from './Checkout.types';
import { useCheckoutView } from './useCheckoutView';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import { useData } from '@/utils/useData';
import { createSubscriptionsService } from '@/services/subscriptions';
import { usePortal } from '@/components/providers/PortalProvider/composables/usePortal';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import CheckoutForm from '@/components/customer/CheckoutForm/CheckoutForm.vue';
import PaymentIntegrationFormPlaceholder from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.placeholder.vue';
import { useCheckoutForm } from '@/components/customer/CheckoutForm/useCheckoutForm';
import Kpi from '@/components/shared/Kpi.vue';

const props = defineProps<CheckoutProps>();

const portal = usePortal();

if (portal.value?.type !== 'INIT_PRICING_PLAN_SUBSCRIPTION') {
    throw Error('Invalid token');
}

const country = ref<string | undefined>(props.countryCode);
const paymentIntegrationFormRef = ref();

const initialState =
    props.countryCode || props.email
        ? {
              ...(props.countryCode ? { country: props.countryCode } : {}),
              ...(props.email ? { email: props.email } : {}),
          }
        : {};

const checkoutForm = useCheckoutForm(initialState);

const context = computed<AuthorizePaymentPayload['context']>(() => {
    const name: Name =
        checkoutForm.form.value.firstName ||
        checkoutForm.form.value.infix ||
        checkoutForm.form.value.lastName
            ? {
                  ...(checkoutForm.form.value.firstName
                      ? { first_name: checkoutForm.form.value.firstName }
                      : {}),
                  ...(checkoutForm.form.value.infix
                      ? { infix: checkoutForm.form.value.infix }
                      : {}),
                  ...(checkoutForm.form.value.lastName
                      ? { last_name: checkoutForm.form.value.lastName }
                      : {}),
              }
            : {};

    const address: Address = {
        ...(checkoutForm.form.value.addressLine1
            ? { line1: checkoutForm.form.value.addressLine1 }
            : {}),
        ...(checkoutForm.form.value.addressLine2
            ? { line2: checkoutForm.form.value.addressLine2 }
            : {}),
        ...(checkoutForm.form.value.city ? { city: checkoutForm.form.value.city } : {}),
        ...(checkoutForm.form.value.postalCode
            ? { postal_code: checkoutForm.form.value.postalCode }
            : {}),
        ...(checkoutForm.form.value.state ? { state: checkoutForm.form.value.state } : {}),
        ...{ country: checkoutForm.form.value.country ?? '' },
    };

    return {
        type: 'INIT_PRICING_PLAN_SUBSCRIPTION',
        init_pricing_plan_subscription: {
            template_pricing_plan_subscription_id: subscriptionId,
            ...(props.enabledPricingIds && {
                enabled_pricings: props.enabledPricingIds.map((enabledPricingId) => ({
                    pricing_id: enabledPricingId,
                })),
            }),
            customer_details: {
                email: checkoutForm.form.value.email ?? '',
                type: checkoutForm.form.value.type,
                ...(checkoutForm.form.value.type === 'INDIVIDUAL'
                    ? {
                          individual: {
                              residential_address: address,
                              ...(name ? { name } : {}),
                          },
                      }
                    : {
                          organization: {
                              registered_address: address,
                              ...{ legal_name: checkoutForm.form.value.companyLegalName ?? '' },
                              ...(checkoutForm.form.value.companyVatNumber
                                  ? { tax_id: checkoutForm.form.value.companyVatNumber }
                                  : {}),
                          },
                      }),
            },
        },
    };
});

const {
    invoicePreview,
    paymentMethodOptions,
    isPending: isPreviewAndPaymentMethodsPending,
} = useCheckoutView({
    country,
    customerType: computed(() => checkoutForm.form.value.type),
    subscriptionId: portal.value?.init_pricing_plan_subscription?.pricing_plan_subscription_id,
    enabledPricingIds: props.enabledPricingIds,
});

watch(
    () => checkoutForm.form.value.country,
    (val) => (country.value = val)
);

const subscriptionId = portal.value?.init_pricing_plan_subscription?.pricing_plan_subscription_id;

const { $t } = useIntl();

const { getSubscription } = createSubscriptionsService();

const { data } = useData({
    getData: async () => {
        const [subscription] = await Promise.all([
            getSubscription({
                id: subscriptionId,
                expanded: true,
            }),
        ]);

        return {
            subscription,
        };
    },
});

const handleSubmit = async () => {
    await checkoutForm.validation.value.$validate();
    paymentIntegrationFormRef.value?.submit();
};

const handleValidateOnSubmit = async () => {
    await checkoutForm.validation.value.$validate();
    return !checkoutForm.validation.value.$invalid;
};
</script>

<template>
    <div class="flex flex-col grow gap-4">
        <!-- header -->
        <div>
            <Typography variant="heading-1">{{
                $t({
                    defaultMessage: 'Pay and subscribe',
                    description: 'The main title of the checkout',
                    id: 'checkout.main_title',
                })
            }}</Typography>
            <Section>
                <SubscriptionSummary
                    v-if="data?.subscription"
                    :avatar="avatar"
                    :invoice="invoicePreview"
                    :subscription="data?.subscription"
                    :enabled-pricing-ids="enabledPricingIds"
                    :loading="isPreviewAndPaymentMethodsPending"
                />
                <!-- left -->
            </Section>
        </div>

        <!-- content -->
        <div class="flex flex-col md:flex-row grow gap-6">
            <!-- left -->
            <div class="grow flex flex-col gap-4">
                <CheckoutForm
                    v-model="checkoutForm.form.value"
                    :validation="checkoutForm.validation"
                    :read-only-email="props.email"
                    :read-only-country="props.countryCode"
                >
                    <Typography variant="heading-3" tag="h2" class="mb-2">{{
                        $t({
                            defaultMessage: 'Payment method',
                            id: 'checkout.payment_method_block.title',
                            description:
                                'The title of the payment method block in the checkout form',
                        })
                    }}</Typography>
                    <Typography v-if="!country" variant="body-xs" shade="lighter">{{
                        $t({
                            defaultMessage:
                                'Payment methods will be shown after you select a country',
                            id: 'checkout.payment_method_block.payment_methods_not_loaded_message',
                            description:
                                "The messages shown when no country is selected thus the payment methods can't be shown",
                        })
                    }}</Typography>
                    <PaymentIntegrationFormPlaceholder
                        v-else-if="isPreviewAndPaymentMethodsPending"
                    />
                    <PaymentIntegrationForm
                        v-else-if="invoicePreview"
                        ref="paymentIntegrationFormRef"
                        :country-code="country"
                        :context="context"
                        :amount="invoicePreview.invoice_amount_including_tax"
                        variant="AUTHORIZE"
                        :payment-method-options="paymentMethodOptions ?? []"
                        redirect-url="https://www.solvimon.com"
                        :validate-on-submit="handleValidateOnSubmit"
                        @error="(error) => $emit('error', error)"
                    />

                    <template #submit-button>
                        <Button type="button" size="lg" class="mt-6" @click="handleSubmit">
                            {{
                                $t({
                                    defaultMessage: 'Pay and subscribe',
                                    id: 'checkout.pay_and_subscribe_button.label',
                                    description:
                                        'The label of the pay and subscribe button in the checkout form',
                                })
                            }}</Button
                        >
                    </template>
                </CheckoutForm>
            </div>

            <!-- right -->
            <div class="flex flex-col gap-4 w-full md:w-72">
                <Section
                    :title="
                        $t({
                            defaultMessage: 'Order summary',
                            id: 'checkout.order_summary_block.title',
                            description:
                                'The title of the order summary block that lists the subscription cost in the checkout',
                        })
                    "
                >
                    <InvoicePreview
                        v-if="invoicePreview"
                        :invoice="invoicePreview"
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

                <div class="flex gap-4 grow text-gray-400">
                    <Kpi
                        icon="shield_locked-fill"
                        :kpi="
                            $t({
                                defaultMessage: 'Secure checkout',
                                id: 'checkout.kpi.secure_checkout.label',
                                description: 'The secure checkout KPI shown in the checkout',
                            })
                        "
                    />
                    <Kpi
                        icon="lock"
                        :kpi="
                            $t({
                                defaultMessage: 'Encrypted payments',
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
