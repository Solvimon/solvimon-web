<script setup lang="ts">
import {
    Button,
    ChargeOnDemandForm,
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
import { getSubscriptionName } from '@/utils/subscription';

const props = defineProps<ChargeOnDemandModalProps>();
const emit = defineEmits<ChargeOnDemandModalEmits>();

const { $t } = useIntl();

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

watch(
    payablePaymentMethods,
    (methods) => {
        if (!methods.some(({ id }) => id === paymentMethodId.value)) {
            paymentMethodId.value = methods[0]?.id;
        }
    },
    { immediate: true },
);

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
    $t({
        defaultMessage: 'Order on-demand items',
        description: 'Title of the modal for ordering the on-demand items of a subscription',
        id: 'charge_on_demand_modal.title',
    }),
);

const subTitle = computed(() =>
    $t(
        {
            defaultMessage:
                'One-off items for your {subscription} subscription. You pay once, today.',
            description: 'Subtitle of the modal for ordering the on-demand items of a subscription',
            id: 'charge_on_demand_modal.subtitle',
        },
        { subscription: subscriptionName.value },
    ),
);

const cancelButtonText = computed(() =>
    $t({
        defaultMessage: 'Cancel',
        description: 'Closes the modal for ordering on-demand items',
        id: 'charge_on_demand_modal.cancel_button.label',
    }),
);

const confirmButtonText = computed(() => {
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

const handleCancel = () => {
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
    },
);
</script>

<template>
    <WalletModalShell
        class="sv-charge-on-demand-modal"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-pending="false"
        :panes="CHARGE_ON_DEMAND_MODAL_STEPS"
        :step="step"
        add-payment-method-pane="ADD_PAYMENT_METHOD"
        :customer="customer"
        @cancel="handleCancel"
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

        <template #footer>
            <div class="flex flex-col gap-2">
                <Button
                    v-if="canTakePayments"
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
