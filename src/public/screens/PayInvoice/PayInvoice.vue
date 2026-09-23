<script setup lang="ts">
import {
    Button,
    Checkbox,
    formatAmount,
    Icon,
    InvoiceHeader,
    InvoiceSummary,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { ref } from 'vue';
import type { PayInvoiceProps } from './PayInvoice.types';
import { ContentWithAsideLayout } from '@/layouts';
import PaymentIntegrationForm from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.vue';
import Skeleton from '@/components/shared/Skeleton.vue';
import PaymentFeedbackCard from '@/components/payments/PaymentFeedbackCard/PaymentFeedbackCard.vue';
import type { SelectedPaymentMethod } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';
import PayButton from '@/components/payments/PayButton/PayButton.vue';
import PaymentMethodsUnavailableCard from '@/components/payments/PaymentMethodsUnavailableCard/PaymentMethodsUnavailableCard.vue';
import { usePaymentMethodAvailability } from '@/composables/usePaymentMethodAvailability';

const { $t } = useIntl();

const props = withDefaults(defineProps<PayInvoiceProps>(), {
    paymentAttempts: () => [],
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

function handleSubmit() {
    if (!paymentIntegrationFormRef.value) {
        throw new Error('payment integration form not found');
    }

    isPaymentPending.value = true;
    paymentIntegrationFormRef.value.submit();
}

const handlePaymentSuccess = () => {
    if (props.configuration.onPaymentSuccess) {
        props.configuration.onPaymentSuccess();
    }
};

const handlePaymentFailed = () => {
    isPaymentPending.value = false;
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
                    :download-service="() => downloadService!(invoice!.id)"
                />
            </Skeleton>
        </template>
        <template #content>
            <!-- loading data -->
            <Skeleton v-if="isLoading" variant="section" class="min-h-[300px]" />

            <!-- invoice fully paid -->
            <PaymentFeedbackCard
                v-if="invoice?.paid"
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
                v-else-if="error"
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
                <Section
                    v-if="availability === 'READY'"
                    :title="
                        $t({
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
                    <div :class="{ 'pointer-events-none opacity-60': isPaymentPending }">
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
                            variant="AUTHORIZE"
                            @payment-success="handlePaymentSuccess"
                            @payment-failed="handlePaymentFailed"
                            @select="(payload) => (selectedPaymentMethod = payload)"
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
                        @click="() => downloadService?.(invoice!.id)"
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
                <InvoiceSummary v-if="invoice" :invoice="invoice" />
            </Skeleton>

            <div v-if="invoice && availability === 'READY'">
                <PayButton
                    :disabled="!selectedPaymentMethod || isPaymentPending"
                    :loading="isPaymentPending"
                    :amount="amount"
                    :payment-method="selectedPaymentMethod"
                    @click="handleSubmit"
                />
            </div>
        </template>
    </ContentWithAsideLayout>
</template>
