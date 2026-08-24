<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { helpers, required } from '@vuelidate/validators';
import { useIntl, useValidation } from '@solvimon/solvimon-ui';
import type { AutoTopUpModalEmits, AutoTopUpModalProps } from './AutoTopUpModal.types';
import { AUTO_TOP_UP_MODAL_STEPS, type AutoTopUpModalStep } from './AutoTopUpModal.types';
import {
    getActiveAutoTopUpConfig,
    getAutoTopUpChargeTarget,
    toAutoTopUpRule,
    toCreateAutoTopUpConfigPayload,
} from './AutoTopUpModal.lib';
import AutoTopUpConfigEditor from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.vue';
import type { AutoTopUpRule } from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.types';
import {
    getAutoTopUpEditorConfig,
    getTopUpPricingItems,
} from '@/components/wallets/TopUpModal/TopUpModal.lib';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';
import WalletModalShell from '@/components/wallets/WalletModalShell.vue';
import TopUpInvoicePreview from '@/components/wallets/TopUpModal/TopUpInvoicePreview.vue';
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';
import { useDefaultPaymentMethod } from '@/composables/useDefaultPaymentMethod';
import { useWalletBalanceFormat } from '@/composables/useWalletBalanceFormat';
import { useAddPaymentMethodStep } from '@/composables/useAddPaymentMethodStep';
import { useSaveAutoTopUpConfig } from '@/composables/useSaveAutoTopUpConfig';

const props = defineProps<AutoTopUpModalProps>();
const emit = defineEmits<AutoTopUpModalEmits>();

const { $t } = useIntl();
const { formatOpenBalance } = useWalletBalanceFormat();

const step = ref<AutoTopUpModalStep>('AUTO_TOP_UP');

const currentBalance = computed(() => formatOpenBalance(props.walletBalanceItem));

const topUpPricingItems = computed(() => getTopUpPricingItems(props.walletBalanceItem));

const autoTopUpEditor = computed(() => getAutoTopUpEditorConfig(topUpPricingItems.value));

const savedConfig = computed(() => getActiveAutoTopUpConfig(props.walletBalanceItem));
const savedRule = computed<AutoTopUpRule | undefined>(() => toAutoTopUpRule(savedConfig.value));

const chargeTarget = computed(() =>
    getAutoTopUpChargeTarget(props.topUpItem, topUpPricingItems.value),
);

const autoTopUpFormRef = ref<InstanceType<typeof AutoTopUpConfigEditor>>();

const previewPricingItems = computed(() => {
    const amount = autoTopUpFormRef.value?.rule?.topup_amount;

    return amount?.quantity && chargeTarget.value
        ? [{ pricing_item_id: chargeTarget.value.pricingItemId, flexible_amount: amount }]
        : undefined;
});

const previewScheduleId = computed(() => chargeTarget.value?.pricingPlanScheduleId);

const selectedPaymentMethodId = ref<string | undefined>();

const { sortedPaymentMethods } = useDefaultPaymentMethod({
    paymentMethods: computed(() => props.paymentMethods),
    selectedPaymentMethodId,
    preferredPaymentMethodId: computed(() => savedConfig.value?.payment_method_id),
});

const {
    paymentMethodOptions,
    settledOptions,
    isPending: isPaymentMethodOptionsPending,
} = useCustomerPaymentMethodOptions({
    isOpen: computed(() => props.showModal),
    customer: computed(() => props.customer),
});

const {
    paneRef: addPaymentMethodRef,
    isActive: isAddingPaymentMethod,
    isSaving: isSavingPaymentMethod,
    open: openAddPaymentMethod,
    leave: leaveAddPaymentMethod,
    submit: submitPaymentMethod,
} = useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'AUTO_TOP_UP' });

const { save: saveRule, isSaving: isSavingRule } = useSaveAutoTopUpConfig();

const isPending = computed(() => isSavingPaymentMethod.value || isSavingRule.value);

const validationState = reactive({
    paymentMethodId: computed(() => selectedPaymentMethodId.value ?? null),
});

const validation = useValidation(
    {
        paymentMethodId: {
            required: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'Select a payment method to pay for automatic top-ups.',
                        description:
                            'Error shown in the auto top-up modal when no payment method is selected',
                        id: 'auto_topup_modal.payment_method.required',
                    }),
                required,
            ),
        },
    },
    validationState,
);

const title = computed(() =>
    step.value === 'ADD_PAYMENT_METHOD'
        ? $t({
              defaultMessage: 'Add payment method',
              description:
                  'Title of the auto top-up modal while the customer is adding a payment method',
              id: 'auto_topup_modal.add_payment_method.title',
          })
        : $t({
              defaultMessage: 'Automatic top-up',
              description: 'Title of the automatic wallet top-up modal',
              id: 'auto_topup_modal.title',
          }),
);

const subTitle = computed(() =>
    step.value === 'ADD_PAYMENT_METHOD'
        ? $t({
              defaultMessage: 'This method pays for every automatic top-up.',
              description:
                  'Subtitle of the auto top-up modal while the customer is adding a payment method',
              id: 'auto_topup_modal.add_payment_method.subtitle',
          })
        : $t(
              {
                  defaultMessage:
                      'Your current balance is {balance}. Enable auto top so you can stay productive',
                  description: 'Subtitle of the automatic wallet top-up modal, naming the balance',
                  id: 'auto_topup_modal.subtitle',
              },
              { balance: currentBalance.value },
          ),
);

const cancelButtonText = computed(() =>
    step.value === 'ADD_PAYMENT_METHOD'
        ? $t({
              defaultMessage: 'Back',
              description: 'Button returning from adding a payment method to the auto top-up rule',
              id: 'auto_topup_modal.add_payment_method.cancel',
          })
        : $t({
              defaultMessage: 'Cancel',
              description: 'Button dismissing the auto top-up modal',
              id: 'auto_topup_modal.cancel',
          }),
);

const confirmButtonText = computed(() =>
    step.value === 'ADD_PAYMENT_METHOD'
        ? $t({
              defaultMessage: 'Add payment method',
              description: 'Button storing the payment method being added in the auto top-up modal',
              id: 'auto_topup_modal.add_payment_method.confirm',
          })
        : $t({
              defaultMessage: 'Save',
              description: 'Button saving the automatic top-up rule',
              id: 'auto_topup_modal.confirm',
          }),
);

async function save() {
    validation.value.$touch();

    if (isPending.value) {
        return;
    }

    const { saved, error } = await saveRule(
        toCreateAutoTopUpConfigPayload({
            rule: autoTopUpFormRef.value?.validate(),
            walletBalanceItem: props.walletBalanceItem,
            chargeTarget: chargeTarget.value,
            paymentMethodId: selectedPaymentMethodId.value,
        }),
    );

    if (saved) {
        emit('saved');
        emit('close');
        return;
    }

    if (error) {
        emit('payment-failed', error);
    }
}

const handleConfirm = () => {
    if (isAddingPaymentMethod.value) {
        submitPaymentMethod();
        return;
    }

    void save();
};

const handlePaymentSuccess = () => {
    leaveAddPaymentMethod();
    emit('payment-success');
};

/**
 * While adding a payment method, cancelling steps back to the rule rather than closing: the customer
 * came here to set a rule up, so the add is a detour. Anywhere else it closes.
 *
 * The modal reports its cancel button and its close cross as the same event, so the cross steps back
 * too — they cannot be told apart without replacing the footer.
 */
const handleCancel = () => {
    // The request is already out, so there is nothing left to back out of. The modal cannot disable
    if (isPending.value) {
        return;
    }

    if (isAddingPaymentMethod.value) {
        leaveAddPaymentMethod();
        return;
    }

    emit('close');
};

const formKey = ref(0);

watch(
    () => props.showModal,
    (showModal) => {
        if (!showModal) {
            return;
        }

        step.value = 'AUTO_TOP_UP';
        selectedPaymentMethodId.value = undefined;
        formKey.value += 1;
    },
);
</script>

<template>
    <WalletModalShell
        ref="addPaymentMethodRef"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-pending="isPending"
        :panes="AUTO_TOP_UP_MODAL_STEPS"
        :step="step"
        add-payment-method-pane="ADD_PAYMENT_METHOD"
        :customer="customer"
        :payment-method-options="paymentMethodOptions"
        :is-payment-method-options-pending="isPaymentMethodOptionsPending"
        :is-adding-payment-method="isAddingPaymentMethod"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @payment-success="handlePaymentSuccess"
        @payment-failed="(error) => $emit('payment-failed', error)"
    >
        <template #AUTO_TOP_UP>
            <div class="grid grid-cols-1 gap-4">
                <AutoTopUpConfigEditor
                    v-if="autoTopUpEditor"
                    :key="formKey"
                    ref="autoTopUpFormRef"
                    class="sv-auto-topup-modal__rule"
                    v-bind="autoTopUpEditor"
                    :config="savedRule"
                    always-enabled
                    :disabled="isPending"
                />

                <TopUpInvoicePreview
                    :pricing-plan-schedule-id="previewScheduleId"
                    :pricing-items="previewPricingItems"
                />

                <PaymentMethodSelector
                    v-model="selectedPaymentMethodId"
                    class="sv-auto-topup-modal__payment-method"
                    :payment-methods="sortedPaymentMethods"
                    :payment-method-options="settledOptions"
                    :disabled="isPending"
                    :error="validation.paymentMethodId.$errors"
                    :label="
                        $t({
                            defaultMessage: 'Pay automatic top-ups with',
                            description:
                                'Label above the payment method an automatic top-up is charged to',
                            id: 'auto_topup_modal.payment_method.label',
                        })
                    "
                    @add-payment-method="openAddPaymentMethod"
                />
            </div>
        </template>
    </WalletModalShell>
</template>
