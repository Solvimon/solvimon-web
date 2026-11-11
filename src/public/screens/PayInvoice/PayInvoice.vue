<script setup lang="ts">
import {
    Button,
    Checkbox,
    DividerText,
    ErrorNotification,
    formatAmount,
    Icon,
    InvoiceHeader,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import type { PayInvoiceProps } from './PayInvoice.types';
import {
    getChargeableStoredPaymentMethods,
    getPreselectedPaymentMethodId,
    getStoredPaymentMethodLabel,
} from './PayInvoice.lib';
import { ContentWithAsideLayout } from '@/layouts';
import { useHostEvent } from '@/components/providers/HostElementProvider/composables/useHostEvent';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';
import type { SelectedPaymentMethod } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';
import PayButton from '@/components/payments/PayButton/PayButton.vue';
import PaymentMethodsUnavailableCard from '@/components/payments/PaymentMethodsUnavailableCard/PaymentMethodsUnavailableCard.vue';
import { usePaymentMethodAvailability } from '@/composables/usePaymentMethodAvailability';
import { usePaymentFormHold } from '@/composables/usePaymentFormHold';
import { useStoredPaymentMethodPayment } from '@/composables/useStoredPaymentMethodPayment';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';
import InvoiceOrderSummary from '@/components/invoices/InvoiceOrderSummary/InvoiceOrderSummary.vue';
import SecurePaymentsKPI from '@/components/payments/SecurePaymentsKPI/SecurePaymentsKPI.vue';
import PaymentErrorCard from '@/components/payments/PaymentErrorCard/PaymentErrorCard.vue';
import { createPaymentFailureError } from '@/utils/paymentFailure';
import type { SdkError } from '@/types/errors';

const { $t } = useIntl();

const props = withDefaults(defineProps<PayInvoiceProps>(), {
    paymentAttempts: () => [],
    paymentMethods: () => [],
});

const { availability } = usePaymentMethodAvailability({
    paymentMethodOptions: () => props.paymentMethodOptions,
    isLoading: () => props.isLoading,
    context: () => ({ invoiceId: props.invoice?.id }),
});

const selectedPaymentMethod = ref<SelectedPaymentMethod>();
const storePaymentMethod = ref(true);
const paymentIntegrationFormRef = ref<InstanceType<typeof PaymentIntegrationForm>>();
const isPaymentPending = ref(false);
const { isFormHeld, handleActionRequired } = usePaymentFormHold(isPaymentPending);
/** Known from the payment itself, before a refetched invoice can say so. */
const isPaid = ref(false);
/** The payment may still go through, so paying again could charge the customer twice. */
const isPaymentUnconfirmed = ref(false);

const storedPaymentMethods = computed(() =>
    getChargeableStoredPaymentMethods(props.paymentMethods, props.paymentMethodOptions ?? []),
);

const selectedStoredPaymentMethodId = ref<PaymentMethod['id']>();

watch(
    storedPaymentMethods,
    (stored) => {
        if (selectedStoredPaymentMethodId.value) return;

        selectedStoredPaymentMethodId.value = getPreselectedPaymentMethodId(
            stored.map(({ paymentMethod }) => paymentMethod),
        );
    },
    { immediate: true },
);

const selectedStoredPaymentMethod = computed(() =>
    storedPaymentMethods.value.find(
        ({ paymentMethod }) => paymentMethod.id === selectedStoredPaymentMethodId.value,
    ),
);

/** Only a method the customer picks in the form takes over from the stored one. */
const handleFormSelect = (payload: SelectedPaymentMethod) => {
    selectedPaymentMethod.value = payload;
    if (!payload.isAutomatic) selectedStoredPaymentMethodId.value = undefined;
};

const storedPaymentMethodsTitle = computed(() =>
    $t({
        id: 'pay_invoice.stored_payment_methods.title',
        defaultMessage: 'Your payment methods',
        description:
            'Section title above the payment methods the customer stored before, on the pay invoice screen',
    }),
);

const { charge: chargeStoredPaymentMethod } = useStoredPaymentMethodPayment();
const storedPaymentError = ref(false);
/**
 * A stored charge whose answer never arrived may still go through, so nothing is left on screen to
 * pay with — the form included, which could otherwise take a second payment by itself.
 */
const storedPaymentUnconfirmed = ref<SdkError>();

const payWithStoredPaymentMethod = async () => {
    const stored = selectedStoredPaymentMethod.value;
    if (!stored || !props.invoice || !props.amount) return;

    isPaymentPending.value = true;
    storedPaymentError.value = false;

    const outcome = await chargeStoredPaymentMethod({
        paymentAcceptorId: stored.paymentAcceptorId,
        customerId: props.invoice.customer.id,
        paymentMethodId: stored.paymentMethod.id,
        invoiceId: props.invoice.id,
        amount: props.amount,
    });

    if (outcome === 'SUCCEEDED') {
        handlePaymentSuccess();
        return;
    }

    if (outcome === 'UNCONFIRMED') {
        isPaymentPending.value = false;
        isPaymentUnconfirmed.value = true;
        storedPaymentUnconfirmed.value = createPaymentFailureError({
            code: 'PAYMENT_OUTCOME_UNCONFIRMED',
            message: 'The charge to the stored payment method could not be confirmed',
        });
        return;
    }

    // A charge turned down because the invoice was paid elsewhere then reads as paid.
    await props.refresh?.();
    isPaymentPending.value = false;
    storedPaymentError.value = true;
};

function handleSubmit() {
    if (selectedStoredPaymentMethod.value) {
        void payWithStoredPaymentMethod();
        return;
    }

    if (!paymentIntegrationFormRef.value) {
        throw new Error('payment integration form not found');
    }

    isPaymentPending.value = true;
    paymentIntegrationFormRef.value.submit();
}

const canPay = computed(
    () =>
        Boolean(selectedStoredPaymentMethod.value || selectedPaymentMethod.value) &&
        !isPaymentPending.value &&
        !isPaymentUnconfirmed.value,
);

const { dispatch, componentName } = useHostEvent();

const handlePaymentSuccess = () => {
    isPaid.value = true;
    isPaymentPending.value = false;
    void props.refresh?.();
    dispatch('solvimon-payment-succeeded', {
        componentName,
        invoiceId: props.configuration.invoiceId,
    });
};

const handlePaymentNotSubmitted = () => {
    isPaymentPending.value = false;
};

const handlePaymentFailed = (error?: { code?: string }) => {
    isPaymentPending.value = false;

    if (error?.code === 'PAYMENT_OUTCOME_UNCONFIRMED') {
        isPaymentUnconfirmed.value = true;
    }
};
</script>

<template>
    <ContentWithAsideLayout>
        <template #header>
            <Skeleton class="min-h-[52px] w-96">
                <InvoiceHeader
                    v-if="invoice && downloadService"
                    :invoice="invoice"
                    :payment-attempts="paymentAttempts"
                    :download-service="() => downloadService!(invoice!)"
                />
            </Skeleton>
        </template>
        <template #content>
            <!-- loading data -->
            <Skeleton v-if="isLoading" variant="section" class="min-h-[300px]" />

            <!-- invoice fully paid -->
            <PaymentFeedbackCard
                v-if="invoice?.paid || (invoice && isPaid)"
                status="success"
                :title="
                    $t({
                        id: 'pay_invoice.paid.title',
                        defaultMessage: 'Thank you for your payment!',
                        description: 'Title shown when the invoice has already been paid',
                    })
                "
                class="mt-8"
            >
                <Typography variant="body-sm" class="mt-1">
                    <Icon icon="check" />{{ formatAmount(invoice.tax_summary.total_amount) }}
                </Typography>
            </PaymentFeedbackCard>

            <!-- error -->
            <PaymentFeedbackCard
                v-else-if="error && !invoice"
                status="error"
                :title="
                    $t({
                        id: 'pay_invoice.error.title',
                        defaultMessage: 'Something went wrong',
                        description: 'Title shown when the invoice payment fails to load',
                    })
                "
            >
                <Typography variant="body-sm" class="mt-1">
                    {{
                        $t({
                            id: 'pay_invoice.error.description',
                            defaultMessage: 'Please try again or contact support.',
                            description: 'Body text shown when the invoice payment fails to load',
                        })
                    }}
                </Typography>
            </PaymentFeedbackCard>

            <!-- payment method form -->
            <template v-else-if="!isLoading && countryCode && amount && invoice">
                <PaymentErrorCard
                    v-if="availability === 'READY' && storedPaymentUnconfirmed"
                    class="sv-pay-invoice__stored-payment-unconfirmed"
                    :error="storedPaymentUnconfirmed"
                />

                <div v-else-if="availability === 'READY'" class="grid grid-cols-1 gap-6">
                    <template v-if="storedPaymentMethods.length">
                        <Section
                            class="sv-pay-invoice__stored-payment-methods"
                            :title="storedPaymentMethodsTitle"
                            content-background="none"
                            no-border
                            no-spacing
                        >
                            <div role="group" :aria-label="storedPaymentMethodsTitle">
                                <PaymentMethodSelector
                                    v-model="selectedStoredPaymentMethodId"
                                    :payment-methods="
                                        storedPaymentMethods.map(
                                            ({ paymentMethod }) => paymentMethod,
                                        )
                                    "
                                    :show-add-option="false"
                                    :disabled="isPaymentPending || isFormHeld"
                                />
                            </div>
                        </Section>

                        <ErrorNotification
                            v-if="storedPaymentError"
                            class="sv-pay-invoice__stored-payment-error sv-error"
                            :title="
                                $t({
                                    id: 'pay_invoice.stored_payment_method.failed',
                                    defaultMessage:
                                        'The payment did not go through. Try again or use another payment method.',
                                    description:
                                        'Shown when charging the invoice to a stored payment method fails',
                                })
                            "
                        />

                        <DividerText
                            :text="
                                $t({
                                    id: 'pay_invoice.stored_payment_methods.divider_text',
                                    defaultMessage: 'or',
                                    description:
                                        'Between the stored payment methods and the form to pay with a new one',
                                })
                            "
                            text-position="center"
                        />
                    </template>

                    <Section
                        :title="
                            storedPaymentMethods.length
                                ? $t({
                                      id: 'pay_invoice.new_payment_method.title',
                                      defaultMessage: 'Pay with a new payment method',
                                      description:
                                          'Section title for the payment form below the stored payment methods, on the pay invoice screen',
                                  })
                                : $t({
                                      id: 'pay_invoice.payment_methods.title',
                                      defaultMessage: 'Payment methods',
                                      description:
                                          'Section title for the payment method selector on the pay invoice screen',
                                  })
                        "
                        content-background="none"
                        no-border
                        no-spacing
                    >
                        <div
                            :class="{ 'pointer-events-none opacity-60': isFormHeld }"
                            :inert="isFormHeld || undefined"
                        >
                            <PaymentIntegrationForm
                                ref="paymentIntegrationFormRef"
                                :amount="amount"
                                :country-code="countryCode"
                                :context="{
                                    type: 'INVOICE',
                                    related_resource_ids: [
                                        {
                                            type: 'INVOICE',
                                            id: invoice.id,
                                        },
                                    ],
                                }"
                                :customer-id="invoice.customer.id"
                                :store-payment-method="storePaymentMethod"
                                :invoice-id="invoice.id"
                                :payment-method-options="paymentMethodOptions ?? []"
                                :open-first-payment-method="!storedPaymentMethods.length"
                                variant="AUTHORIZE"
                                :billing-entity-name="invoice?.billing_entity?.legal_name"
                                @payment-success="handlePaymentSuccess"
                                @payment-failed="handlePaymentFailed"
                                @invalid="handlePaymentNotSubmitted"
                                @submitting="isPaymentPending = true"
                                @action-required="handleActionRequired"
                                @select="handleFormSelect"
                            />
                            <div class="mt-4">
                                <Checkbox
                                    id="pay-invoice-store-payment-method"
                                    v-model="storePaymentMethod"
                                    :label="
                                        $t({
                                            id: 'pay_invoice.store_payment_method.label',
                                            defaultMessage:
                                                'Save this payment method for future payments',
                                            description:
                                                'Label of the checkbox that stores the payment method while paying an invoice',
                                        })
                                    "
                                />
                            </div>
                        </div>
                    </Section>
                </div>

                <!-- nothing the customer can pay with -->
                <PaymentMethodsUnavailableCard
                    v-else
                    variant="AUTHORIZE"
                    :seller-name="invoice.billing_entity?.legal_name"
                >
                    <Button
                        v-if="downloadService"
                        type="button"
                        intent="secondary"
                        @click="() => downloadService?.(invoice!)"
                    >
                        {{
                            $t({
                                defaultMessage: 'Download invoice',
                                description:
                                    'Button that downloads the invoice when it cannot be paid online',
                                id: 'pay_invoice.unavailable.download_invoice',
                            })
                        }}
                    </Button>
                </PaymentMethodsUnavailableCard>
            </template>
        </template>
        <template #aside>
            <Skeleton variant="section" class="min-h-[200px]">
                <InvoiceOrderSummary
                    v-if="invoice"
                    :invoice="invoice"
                    :is-paid="invoice.paid || isPaid"
                />
            </Skeleton>

            <div
                v-if="invoice && !invoice.paid && !isPaid && availability === 'READY'"
                class="flex flex-col gap-2"
            >
                <PayButton
                    :disabled="!canPay"
                    :loading="isPaymentPending"
                    :amount="amount"
                    :payment-method="
                        selectedStoredPaymentMethod ? undefined : selectedPaymentMethod
                    "
                    :payment-method-label="
                        selectedStoredPaymentMethod &&
                        getStoredPaymentMethodLabel(selectedStoredPaymentMethod.paymentMethod)
                    "
                    @click="handleSubmit"
                />

                <SecurePaymentsKPI
                    class="sv-pay-invoice__kpi"
                    :payment-method-options="paymentMethodOptions ?? []"
                />
            </div>
        </template>
    </ContentWithAsideLayout>
</template>
