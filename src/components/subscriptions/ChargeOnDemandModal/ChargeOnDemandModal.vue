<script setup lang="ts">
import {
    Button,
    ChargeOnDemandForm,
    Typography,
    getCustomerCountry,
    getPayablePaymentMethods,
    toChargePricingItems,
    useIntl,
    formatAmount,
} from '@solvimon/solvimon-ui';
import type { ChargeOnDemandSelectionItem } from '@solvimon/solvimon-ui';
import type { PaymentMethod } from '@solvimon/solvimon-types';
import { computed, ref, watch } from 'vue';
import type {
    ChargeOnDemandModalEmits,
    ChargeOnDemandModalProps,
    ChargeOnDemandModalStep,
} from './ChargeOnDemandModal.types';
import { CHARGE_ON_DEMAND_MODAL_STEPS } from './ChargeOnDemandModal.types';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import WalletModalShell from '@/components/wallets/WalletModalShell.vue';
import { useChargeOnDemandInvoicePreview } from '@/composables/useChargeOnDemandInvoicePreview';
import { useAddPaymentMethodStep } from '@/composables/useAddPaymentMethodStep';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { getSubscriptionName } from '@/utils/subscription';

const props = defineProps<ChargeOnDemandModalProps>();
const emit = defineEmits<ChargeOnDemandModalEmits>();

const { $t } = useIntl();
const logger = useLogger();

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

watch(
    () => props.showModal && canTakePayments.value,
    async (shouldLoad) => {
        if (!shouldLoad) return;

        try {
            await loadPaymentMethodOptions({
                subscriptionId: props.subscription.id,
                country: props.customer ? getCustomerCountry(props.customer) : undefined,
            });
        } catch {
            logger.error(
                'PAYMENT_METHOD_OPTIONS_LOAD_FAILED',
                'Failed to load the payment methods an on-demand order can be paid with',
                { subscriptionId: props.subscription.id },
            );
        }
    },
    { immediate: true },
);

const {
    paneRef: addPaymentMethodRef,
    isActive: isAddingPaymentMethod,
    isSaving: isSavingPaymentMethod,
    open: openAddPaymentMethod,
    leave: leaveAddPaymentMethod,
    submit: submitPaymentMethod,
} = useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'ORDER' });

const handleAddPaymentMethod = () => {
    methodIdsBeforeAdding.value = new Set(payablePaymentMethods.value.map(({ id }) => id));
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

const { invoicePreview, isPreviewPending } = useChargeOnDemandInvoicePreview({
    pricingPlanScheduleId: computed(() => props.scheduleId),
    pricingItems,
});

const total = computed(() => invoicePreview.value?.invoice_amount_including_tax);

const canSubmit = computed(
    () =>
        canTakePayments.value &&
        selection.value.length > 0 &&
        !!paymentMethodId.value &&
        !!total.value &&
        !isPreviewPending.value,
);

const subscriptionName = computed(() =>
    getSubscriptionName({
        subscription: props.subscription,
        fallback: $t({
            defaultMessage: 'your',
            description:
                'Stands in for the subscription name in "One-off items for {subscription} subscription" when it has none',
            id: 'charge_on_demand_modal.subscription_name_fallback',
        }),
    }),
);

const title = computed(() =>
    isAddingPaymentMethod.value
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
          }),
);

const subTitle = computed(() =>
    isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Add a payment method to pay for this order.',
              description:
                  'Subtitle of the on-demand order modal while the customer is adding a payment method',
              id: 'charge_on_demand_modal.add_payment_method.subtitle',
          })
        : $t(
              {
                  defaultMessage:
                      'One-off items for your {subscription} subscription. You pay once, today.',
                  description:
                      'Subtitle of the modal for ordering the on-demand items of a subscription',
                  id: 'charge_on_demand_modal.subtitle',
              },
              { subscription: subscriptionName.value },
          ),
);

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

const handleConfirm = () => {
    if (isAddingPaymentMethod.value) {
        submitPaymentMethod();
    }
};

const handleCancel = () => {
    if (isSavingPaymentMethod.value) {
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
    },
);
</script>

<template>
    <WalletModalShell
        ref="addPaymentMethodRef"
        class="sv-charge-on-demand-modal"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-pending="isSavingPaymentMethod"
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
                can-add-payment-method
                @add-payment-method="handleAddPaymentMethod"
            >
                <template #payment-methods-empty>
                    <Typography tag="p" color="secondary" no-spacing>
                        {{
                            $t({
                                defaultMessage: 'Add a payment method to pay for this order.',
                                description:
                                    'Shown in the on-demand order when no saved payment method can pay for it',
                                id: 'charge_on_demand_modal.payment_methods.empty',
                            })
                        }}
                    </Typography>
                </template>
            </ChargeOnDemandForm>
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

        <template #footer>
            <div class="flex flex-col gap-2">
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
                    v-else-if="canTakePayments"
                    size="lg"
                    class="sv-action sv-action--primary"
                    data-testid="charge-on-demand-confirm"
                    :disabled="!canSubmit"
                    >{{ confirmButtonText }}</Button
                >
                <Button
                    size="lg"
                    intent="subtle"
                    class="sv-action sv-action--secondary"
                    data-testid="charge-on-demand-cancel"
                    @click="handleCancel"
                    >{{ cancelButtonText }}</Button
                >
            </div>
        </template>
    </WalletModalShell>
</template>
