<script setup lang="ts">
import {
    Button,
    ChargeOnDemandForm,
    InvoicePreview,
    Section,
    getCustomerCountry,
    getPayablePaymentMethods,
    toChargePricingItems,
    useIntl,
    formatAmount,
} from '@solvimon/solvimon-ui';
import type { ChargeOnDemandSelectionItem } from '@solvimon/solvimon-ui';
import type { Invoice, PaymentMethod } from '@solvimon/solvimon-types';
import { computed, ref, watch } from 'vue';
import type {
    ChargeOnDemandModalEmits,
    ChargeOnDemandModalProps,
    ChargeOnDemandModalStep,
} from './ChargeOnDemandModal.types';
import { CHARGE_ON_DEMAND_MODAL_STEPS } from './ChargeOnDemandModal.types';
import {
    canRetryCharge,
    getChargeFailure,
    isInvoiceSettled,
    type ChargeFailure,
} from './ChargeOnDemandModal.lib';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import OnDemandPaymentModalShell from '@/components/payments/OnDemandPaymentModalShell/OnDemandPaymentModalShell.vue';
import { useChargeOnDemandInvoicePreview } from '@/composables/useChargeOnDemandInvoicePreview';
import { useAddPaymentMethodStep } from '@/composables/useAddPaymentMethodStep';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createInvoicesService } from '@/services/invoices';
import { isApiError } from '@/services/apiError';

const props = defineProps<ChargeOnDemandModalProps>();
const emit = defineEmits<ChargeOnDemandModalEmits>();

const { $t } = useIntl();
const logger = useLogger();
const { chargeOnDemandPricingItems } = createInvoicesService();

const step = ref<ChargeOnDemandModalStep>('ORDER');

const selection = ref<ChargeOnDemandSelectionItem[]>([]);
const paymentMethodId = ref<PaymentMethod['id']>();

/**
 * A charge is only taken through one of the subscription's own payment acceptors. Without one there
 * is no way for the customer to pay, whichever method they hold or add.
 */
const canTakePayments = computed(() => (props.subscription.payment_acceptor_ids ?? []).length > 0);

const payablePaymentMethods = computed(() =>
    getPayablePaymentMethods(props.paymentMethods ?? [], props.subscription),
);

/**
 * The payable methods there were when the customer went to add one. The host reloads the methods
 * once it is stored, and the one not among these is the one just added.
 */
const methodIdsBeforeAdding = ref<Set<PaymentMethod['id']>>();

watch(
    payablePaymentMethods,
    (methods) => {
        const added = methodIdsBeforeAdding.value
            ? methods.find(({ id }) => !methodIdsBeforeAdding.value?.has(id))
            : undefined;

        if (added) {
            paymentMethodId.value = added.id;
            methodIdsBeforeAdding.value = undefined;
            return;
        }

        if (!methods.some(({ id }) => id === paymentMethodId.value)) {
            paymentMethodId.value = methods[0]?.id;
        }
    },
    { immediate: true },
);

const {
    paymentMethodOptions: allPaymentMethodOptions,
    get: loadPaymentMethodOptions,
    isPending: isPaymentMethodOptionsPending,
} = usePaymentMethodOptions();

/**
 * The options endpoint falls back to the platform's payment acceptors for a subscription without its
 * own, and a method stored through one of those cannot pay the charge.
 */
const paymentMethodOptions = computed(() =>
    allPaymentMethodOptions.value.filter(({ payment_acceptor }) =>
        (props.subscription.payment_acceptor_ids ?? []).includes(payment_acceptor.id),
    ),
);

const {
    paneRef: addPaymentMethodRef,
    isActive: isAddingPaymentMethod,
    isSaving: isSavingPaymentMethod,
    open: openAddPaymentMethod,
    leave: leaveAddPaymentMethod,
    submit: submitPaymentMethod,
} = useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'ORDER' });

/**
 * A failed lookup leaves the options empty, which the add-payment-method pane reads as a merchant
 * with no online payment set up. It is kept apart so the customer is told the truth and can retry.
 */
const hasPaymentMethodOptionsLoadFailed = ref(false);
const paymentMethodOptionsError = ref<string>();

const loadSubscriptionPaymentMethodOptions = async () => {
    hasPaymentMethodOptionsLoadFailed.value = false;

    try {
        await loadPaymentMethodOptions({
            customerId: props.subscription.customer_id,
            subscriptionId: props.subscription.id,
            country: props.customer ? getCustomerCountry(props.customer) : undefined,
        });
    } catch (error) {
        hasPaymentMethodOptionsLoadFailed.value = true;
        logger.error(
            'PAYMENT_METHOD_OPTIONS_LOAD_FAILED',
            'Failed to load the payment methods that can be offered',
            { flow: 'ON_DEMAND_ORDER', subscriptionId: props.subscription.id },
            error,
        );

        // A customer already on the add pane would otherwise be left on the "none set up" card.
        if (isAddingPaymentMethod.value) {
            leaveAddPaymentMethod();
            paymentMethodOptionsError.value = $t({
                defaultMessage:
                    "We couldn't load the ways to add a payment method. Please try again.",
                description:
                    'Shown on the on-demand order when the payment methods that can be added failed to load',
                id: 'charge_on_demand_modal.payment_method_options_error',
            });
        }
    }
};

watch(
    () => props.showModal && canTakePayments.value,
    (shouldLoad) => {
        if (shouldLoad) {
            void loadSubscriptionPaymentMethodOptions();
        }
    },
    { immediate: true },
);

const handleAddPaymentMethod = () => {
    methodIdsBeforeAdding.value = new Set(payablePaymentMethods.value.map(({ id }) => id));
    paymentMethodOptionsError.value = undefined;

    if (hasPaymentMethodOptionsLoadFailed.value) {
        void loadSubscriptionPaymentMethodOptions();
    }

    openAddPaymentMethod();
};

const handlePaymentMethodStored = () => {
    leaveAddPaymentMethod();
    emit('payment-method-stored');
};

/** Undefined while nothing is added, which is when the preview clears. */
const pricingItems = computed(() =>
    selection.value.length > 0 ? toChargePricingItems(selection.value, props.items) : undefined,
);

const { invoicePreview, isPreviewPending, hasPreviewFailed, loadPreview } =
    useChargeOnDemandInvoicePreview({
        pricingPlanScheduleId: computed(() => props.scheduleId),
        pricingItems,
    });

const total = computed(() => invoicePreview.value?.invoice_amount_including_tax);

const isCharging = ref(false);
const chargedInvoice = ref<Invoice>();
const chargeFailure = ref<ChargeFailure>();

/** Shown on the order itself, for the failures that leave the customer on it. */
const chargeError = computed(() => {
    switch (chargeFailure.value) {
        case 'PAYMENT_METHOD':
            return $t({
                defaultMessage: "This payment method can't pay for this order. Choose another one.",
                description:
                    'Shown on the on-demand order when the chosen payment method cannot pay for it',
                id: 'charge_on_demand_modal.charge_error.payment_method',
            });
        case 'SUBSCRIPTION_INACTIVE':
            return $t({
                defaultMessage: "This subscription can't take orders right now.",
                description:
                    'Shown on the on-demand order when the subscription is not active, so nothing can be ordered on it',
                id: 'charge_on_demand_modal.charge_error.subscription_inactive',
            });
        case 'INVALID':
            return $t({
                defaultMessage: "We couldn't complete your order. Please try again later.",
                description: 'Shown on the on-demand order when charging it failed',
                id: 'charge_on_demand_modal.charge_error',
            });
        default:
            return undefined;
    }
});

const isOrderingBlocked = computed(() => chargeFailure.value === 'SUBSCRIPTION_INACTIVE');

// Another method answers "this method can't pay", so the message goes once one is chosen.
watch(paymentMethodId, () => {
    if (chargeFailure.value === 'PAYMENT_METHOD') {
        chargeFailure.value = undefined;
    }
});

const previewError = computed(() =>
    hasPreviewFailed.value
        ? $t({
              defaultMessage: "We couldn't calculate the total. Please try again.",
              description: 'Shown on the on-demand order when its total failed to load',
              id: 'charge_on_demand_modal.preview_error',
          })
        : undefined,
);

/** A failed total is asked for again from the pay button, which has nothing to pay until then. */
const canRetryPreview = computed(
    () => hasPreviewFailed.value && !isPreviewPending.value && !isCharging.value,
);

const formError = computed(
    () => chargeError.value ?? previewError.value ?? paymentMethodOptionsError.value,
);

/** The order is through, paid or not, and an invoice exists for it. */
const isOrderPlaced = computed(() => step.value === 'SUCCESS' || step.value === 'NOT_PAID');

const canSubmit = computed(
    () =>
        !isCharging.value &&
        canTakePayments.value &&
        !isOrderingBlocked.value &&
        selection.value.length > 0 &&
        !!paymentMethodId.value &&
        !!total.value &&
        !isPreviewPending.value,
);

const title = computed(() => {
    if (step.value === 'SUCCESS') {
        return $t({
            defaultMessage: 'Payment successful',
            description: 'Title of the on-demand order modal once the order has been paid',
            id: 'charge_on_demand_modal.success.title',
        });
    }

    if (step.value === 'NOT_PAID') {
        return $t({
            defaultMessage: 'Payment not completed',
            description:
                'Title of the on-demand order modal when the order was placed but its payment did not go through',
            id: 'charge_on_demand_modal.not_paid.title',
        });
    }

    if (step.value === 'NOT_CONFIRMED') {
        switch (chargeFailure.value) {
            case 'NOT_COMPLETED':
                return $t({
                    defaultMessage: 'Payment not completed',
                    description:
                        'Title of the on-demand order modal when the order was placed but its payment did not go through',
                    id: 'charge_on_demand_modal.not_paid.title',
                });
            case 'IN_PROGRESS':
                return $t({
                    defaultMessage: 'Order already being processed',
                    description:
                        'Title of the on-demand order modal when a payment for the order is already in progress',
                    id: 'charge_on_demand_modal.in_progress.title',
                });
            default:
                return $t({
                    defaultMessage: "We couldn't confirm your order",
                    description:
                        'Title of the on-demand order modal when it is unknown whether the order went through',
                    id: 'charge_on_demand_modal.unconfirmed.title',
                });
        }
    }

    return isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Add payment method',
              description:
                  'Title of the on-demand order modal while the customer is adding a payment method',
              id: 'charge_on_demand_modal.add_payment_method.title',
          })
        : $t({
              defaultMessage: 'Order on-demand items',
              description: 'Title of the modal for ordering the on-demand items of a subscription',
              id: 'charge_on_demand_modal.title',
          });
});

const subTitle = computed(() => {
    if (step.value === 'SUCCESS') {
        return $t({
            defaultMessage: 'Your order is paid. The invoice is in your invoice list.',
            description: 'Subtitle of the on-demand order modal once the order has been paid',
            id: 'charge_on_demand_modal.success.subtitle',
        });
    }

    if (step.value === 'NOT_PAID') {
        return $t({
            defaultMessage:
                "Your order was placed, but the payment didn't go through. You'll find the invoice in your invoice list.",
            description:
                'Subtitle of the on-demand order modal when the order was placed but its payment did not go through',
            id: 'charge_on_demand_modal.not_paid.subtitle',
        });
    }

    if (step.value === 'NOT_CONFIRMED') {
        switch (chargeFailure.value) {
            case 'NOT_COMPLETED':
                return $t({
                    defaultMessage:
                        "The payment didn't go through. If an invoice was created for this order, you'll find it in your invoice list.",
                    description:
                        'Subtitle of the on-demand order modal when the payment failed and it is not known whether an invoice was created',
                    id: 'charge_on_demand_modal.not_completed.subtitle',
                });
            case 'IN_PROGRESS':
                return $t({
                    defaultMessage:
                        'A payment for this order is already in progress. Check your invoice list in a moment.',
                    description:
                        'Subtitle of the on-demand order modal when a payment for the order is already in progress',
                    id: 'charge_on_demand_modal.in_progress.subtitle',
                });
            default:
                return $t({
                    defaultMessage:
                        'Something went wrong while placing your order. Check your invoice list before trying again.',
                    description:
                        'Subtitle of the on-demand order modal when it is unknown whether the order went through',
                    id: 'charge_on_demand_modal.unconfirmed.subtitle',
                });
        }
    }

    return isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Add a payment method to pay for this order.',
              description:
                  'Subtitle of the on-demand order modal while the customer is adding a payment method',
              id: 'charge_on_demand_modal.add_payment_method.subtitle',
          })
        : undefined;
});

const cancelButtonText = computed(() =>
    isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Back',
              description:
                  'Leaves the add payment method step of the on-demand order modal for the order',
              id: 'charge_on_demand_modal.back_button.label',
          })
        : $t({
              defaultMessage: 'Cancel',
              description: 'Closes the modal for ordering on-demand items',
              id: 'charge_on_demand_modal.cancel_button.label',
          }),
);

const confirmButtonText = computed(() => {
    if (step.value === 'SUCCESS') {
        return $t({
            defaultMessage: 'Done',
            description: 'Closes the on-demand order modal once the order has been paid',
            id: 'charge_on_demand_modal.done_button.label',
        });
    }

    if (step.value === 'NOT_PAID' || step.value === 'NOT_CONFIRMED') {
        return $t({
            defaultMessage: 'Close',
            description:
                'Closes the on-demand order modal when the order was placed but its payment did not go through',
            id: 'charge_on_demand_modal.close_button.label',
        });
    }

    if (isAddingPaymentMethod.value) {
        return $t({
            defaultMessage: 'Save payment method',
            description:
                'Confirm button of the on-demand order modal while the customer is adding a payment method',
            id: 'charge_on_demand_modal.save_payment_method.label',
        });
    }

    if (selection.value.length === 0) {
        return $t({
            defaultMessage: 'Add an item to continue',
            description: 'Disabled pay button of the on-demand order while no item is added',
            id: 'charge_on_demand_modal.confirm_button.no_items',
        });
    }

    if (canRetryPreview.value) {
        return $t({
            defaultMessage: 'Calculate total again',
            description: 'Pay button of the on-demand order when its total failed to load',
            id: 'charge_on_demand_modal.confirm_button.retry_preview',
        });
    }

    if (!total.value || isPreviewPending.value) {
        return $t({
            defaultMessage: 'Updating total…',
            description: 'Disabled pay button of the on-demand order while its total is calculated',
            id: 'charge_on_demand_modal.confirm_button.updating',
        });
    }

    return $t(
        {
            defaultMessage: 'Pay {total}',
            description: 'Pay button of the on-demand order, with the total it charges',
            id: 'charge_on_demand_modal.confirm_button.pay',
        },
        { total: formatAmount(total.value) },
    );
});

const charge = async () => {
    const pricingItemsToCharge = pricingItems.value;

    if (!canSubmit.value || !pricingItemsToCharge || !paymentMethodId.value) {
        return;
    }

    isCharging.value = true;
    chargeFailure.value = undefined;

    try {
        // Finalizing charges the invoice in the same request, so it is only asked for together with
        // the payment method that pays it: without one the backend creates the invoice and then fails.
        const invoice = await chargeOnDemandPricingItems({
            pricing_plan_schedule_id: props.scheduleId,
            pricing_items: pricingItemsToCharge,
            payment_method_id: paymentMethodId.value,
            finalize_immediately: true,
        });

        chargedInvoice.value = invoice;
        emit('invoice-created', invoice);
        // A successful response only means the invoice was created and a payment attempted. The
        // endpoint also answers 200 with the invoice left unpaid when:
        // - Adyen refuses, errors on or cancels the payment (its result code is not mapped to a failure),
        // - Adyen or Stripe leave it pending, such as a stored SEPA debit or Stripe `processing`,
        // - the gateway asks for an action, such as 3DS on a Stripe card, which nobody can complete here.
        // The invoice cannot tell these apart, so they share one outcome. See MD-5539, points 5 to 9.
        step.value = isInvoiceSettled(invoice) ? 'SUCCESS' : 'NOT_PAID';
    } catch (error) {
        const failure = getChargeFailure(error);
        chargeFailure.value = failure;

        // Only the failures refused before an invoice is created leave the customer on the order.
        // Any other may have left an invoice or a payment behind, and a second try a second order.
        if (!canRetryCharge(failure) && failure !== 'SUBSCRIPTION_INACTIVE') {
            step.value = 'NOT_CONFIRMED';
        }

        const context = {
            scheduleId: props.scheduleId,
            failure,
            ...(isApiError(error)
                ? { statusCode: error.statusCode, field: error.field, requestId: error.requestId }
                : {}),
        };

        if (failure === 'INVALID' || failure === 'UNCONFIRMED') {
            logger.error(
                'ON_DEMAND_CHARGE_FAILED',
                'Failed to charge the on-demand order',
                context,
                error,
            );
        } else {
            logger.warn(
                'ON_DEMAND_CHARGE_REFUSED',
                'The on-demand order was refused or its payment did not go through',
                context,
                error,
            );
        }
    } finally {
        isCharging.value = false;
    }
};

const handleConfirm = () => {
    if (isAddingPaymentMethod.value) {
        submitPaymentMethod();
        return;
    }

    if (canRetryPreview.value) {
        void loadPreview();
        return;
    }

    void charge();
};

/** Reported on the way out, so nothing is reloaded under a receipt still being read. */
const handleDone = () => {
    if (chargedInvoice.value && isInvoiceSettled(chargedInvoice.value)) {
        emit('order-paid');
    }
    emit('close');
};

const viewInvoiceButtonText = computed(() =>
    $t({
        defaultMessage: 'Go to invoice',
        description: 'Opens the invoice of the on-demand order the customer just placed',
        id: 'charge_on_demand_modal.view_invoice_button.label',
    }),
);

const handleViewInvoice = () => {
    const invoice = chargedInvoice.value;

    handleDone();

    if (invoice) {
        emit('view-invoice', invoice.id);
    }
};

const handleCancel = () => {
    if (isSavingPaymentMethod.value || isCharging.value) {
        return;
    }

    if (isOrderPlaced.value) {
        handleDone();
        return;
    }

    if (isAddingPaymentMethod.value) {
        leaveAddPaymentMethod();
        return;
    }

    emit('close');
};

watch(
    () => props.showModal,
    (showModal) => {
        if (!showModal) {
            return;
        }

        step.value = 'ORDER';
        selection.value = [];
        methodIdsBeforeAdding.value = undefined;
        chargedInvoice.value = undefined;
        chargeFailure.value = undefined;
        paymentMethodOptionsError.value = undefined;
    },
);
</script>

<template>
    <OnDemandPaymentModalShell
        ref="addPaymentMethodRef"
        class="sv-charge-on-demand-modal"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-pending="isSavingPaymentMethod || isCharging"
        :panes="CHARGE_ON_DEMAND_MODAL_STEPS"
        :step="step"
        add-payment-method-pane="ADD_PAYMENT_METHOD"
        :customer="customer"
        :payment-method-options="paymentMethodOptions"
        :is-payment-method-options-pending="isPaymentMethodOptionsPending"
        :is-adding-payment-method="isAddingPaymentMethod"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @payment-success="handlePaymentMethodStored"
        @payment-failed="(error) => $emit('payment-failed', error)"
    >
        <template #ORDER>
            <ChargeOnDemandForm
                v-if="canTakePayments"
                v-model:selection="selection"
                v-model:payment-method-id="paymentMethodId"
                class="sv-charge-on-demand-modal__form"
                :items="items"
                :preview="invoicePreview"
                :is-preview-loading="isPreviewPending"
                :payment-methods="payablePaymentMethods"
                :errors="formError ? { form: formError } : undefined"
                :disabled="isCharging"
                can-add-payment-method
                @add-payment-method="handleAddPaymentMethod"
            />

            <EmptyStatePlaceholder
                v-else
                class="sv-charge-on-demand-modal__unavailable"
                icon="credit_card_off"
            >
                <template #title>
                    {{
                        $t({
                            defaultMessage: "Ordering isn't available",
                            description:
                                'Title shown instead of the on-demand order form when the subscription cannot take payments',
                            id: 'charge_on_demand_modal.unavailable.title',
                        })
                    }}
                </template>
                <template #message>
                    {{
                        $t({
                            defaultMessage:
                                "This subscription can't take payments here. Contact us to order these items.",
                            description:
                                'Message shown instead of the on-demand order form when the subscription cannot take payments',
                            id: 'charge_on_demand_modal.unavailable.message',
                        })
                    }}
                </template>
            </EmptyStatePlaceholder>
        </template>

        <template v-for="placedStep in ['SUCCESS', 'NOT_PAID']" :key="placedStep" #[placedStep]>
            <Section
                v-if="chargedInvoice"
                class="sv-charge-on-demand-modal__receipt"
                content-background="none"
            >
                <InvoicePreview
                    :invoice="chargedInvoice"
                    is-customer-facing
                    :is-paid="isInvoiceSettled(chargedInvoice)"
                />
            </Section>
        </template>

        <template #footer>
            <div v-if="isOrderPlaced" class="flex flex-col gap-2">
                <!-- An unpaid order's way forward is its invoice, so that is what it leads with. -->
                <Button
                    v-if="step === 'NOT_PAID'"
                    size="lg"
                    class="sv-action sv-action--primary"
                    data-testid="charge-on-demand-view-invoice"
                    @click="handleViewInvoice"
                    >{{ viewInvoiceButtonText }}</Button
                >
                <Button
                    size="lg"
                    :intent="step === 'NOT_PAID' ? 'subtle' : 'primary'"
                    :class="[
                        'sv-action',
                        step === 'NOT_PAID' ? 'sv-action--secondary' : 'sv-action--primary',
                    ]"
                    data-testid="charge-on-demand-done"
                    @click="handleDone"
                    >{{ confirmButtonText }}</Button
                >
                <Button
                    v-if="step === 'SUCCESS'"
                    size="lg"
                    intent="subtle"
                    class="sv-action sv-action--secondary"
                    data-testid="charge-on-demand-view-invoice"
                    @click="handleViewInvoice"
                    >{{ viewInvoiceButtonText }}</Button
                >
            </div>
            <div v-else-if="step === 'NOT_CONFIRMED'" class="flex flex-col gap-2">
                <Button
                    size="lg"
                    class="sv-action sv-action--primary"
                    data-testid="charge-on-demand-close"
                    @click="handleCancel"
                    >{{ confirmButtonText }}</Button
                >
            </div>
            <div v-else class="flex flex-col gap-2">
                <Button
                    v-if="isAddingPaymentMethod"
                    size="lg"
                    class="sv-action sv-action--primary"
                    data-testid="charge-on-demand-save-payment-method"
                    :loading="isSavingPaymentMethod"
                    @click="handleConfirm"
                    >{{ confirmButtonText }}</Button
                >
                <Button
                    v-else-if="canTakePayments && !isOrderingBlocked"
                    size="lg"
                    class="sv-action sv-action--primary"
                    data-testid="charge-on-demand-confirm"
                    :disabled="!canSubmit && !canRetryPreview"
                    :loading="isCharging"
                    @click="handleConfirm"
                    >{{ confirmButtonText }}</Button
                >
                <Button
                    size="lg"
                    intent="subtle"
                    class="sv-action sv-action--secondary"
                    data-testid="charge-on-demand-cancel"
                    :disabled="isCharging"
                    @click="handleCancel"
                    >{{ cancelButtonText }}</Button
                >
            </div>
        </template>
    </OnDemandPaymentModalShell>
</template>
