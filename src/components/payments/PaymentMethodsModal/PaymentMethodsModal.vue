<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button, useIntl } from '@solvimon/solvimon-ui';
import {
    PAYMENT_METHODS_MODAL_STEPS,
    type PaymentMethodsModalEmits,
    type PaymentMethodsModalProps,
    type PaymentMethodsModalStep,
} from './PaymentMethodsModal.types';
import OnDemandPaymentModalShell from '@/components/payments/OnDemandPaymentModalShell/OnDemandPaymentModalShell.vue';
import PaymentMethodsList from '@/components/payments/PaymentMethodsList/PaymentMethodsList.vue';
import { useAddPaymentMethodStep } from '@/composables/useAddPaymentMethodStep';
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';

const props = defineProps<PaymentMethodsModalProps>();
const emit = defineEmits<PaymentMethodsModalEmits>();

const { $t } = useIntl();

const step = ref<PaymentMethodsModalStep>('LIST');
/** The step the modal opened on, which is where closing it is one step back. */
const openedAt = ref<PaymentMethodsModalStep>('LIST');

const { settledOptions, isPending: isPaymentMethodOptionsPending } =
    useCustomerPaymentMethodOptions({
        isOpen: computed(() => props.showModal),
        customer: computed(() => props.customer),
    });

const {
    paneRef: addPaymentMethodRef,
    isActive: isAddingPaymentMethod,
    isSaving,
    open: openAddPaymentMethod,
    leave: leaveAddPaymentMethod,
    submit: submitPaymentMethod,
} = useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'LIST' });

watch(
    () => props.showModal,
    (isShown) => {
        if (!isShown) return;

        openedAt.value = props.start ?? 'LIST';
        step.value = openedAt.value;
    },
    { immediate: true },
);

const handleConfirm = () => {
    if (isAddingPaymentMethod.value) submitPaymentMethod();
};

const handleCancel = () => {
    if (isSaving.value) return;

    if (isAddingPaymentMethod.value && openedAt.value === 'LIST') {
        leaveAddPaymentMethod();
        return;
    }

    emit('close');
};

/** Back to the list, where the new method shows, unless the modal was opened for just adding it. */
const handlePaymentSuccess = () => {
    emit('changed');

    if (openedAt.value === 'ADD_PAYMENT_METHOD') {
        emit('close');
        return;
    }

    leaveAddPaymentMethod();
};

const title = computed(() =>
    isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Add payment method',
              id: 'payment_methods_modal.add.title',
              description: 'Title of the payment methods modal while a payment method is added',
          })
        : $t({
              defaultMessage: 'Payment methods',
              id: 'payment_methods_modal.title',
              description: "Title of the modal that lists the customer's payment methods",
          }),
);

const subTitle = computed(() =>
    isAddingPaymentMethod.value
        ? $t({
              defaultMessage: 'Add a payment method to pay your invoices with.',
              id: 'payment_methods_modal.add.subtitle',
              description: 'Subtitle of the payment methods modal while a payment method is added',
          })
        : $t({
              defaultMessage: 'Set your default payment method, or add or delete one.',
              id: 'payment_methods_modal.subtitle',
              description: "Subtitle of the modal that lists the customer's payment methods",
          }),
);

const confirmButtonText = computed(() =>
    $t({
        defaultMessage: 'Save payment method',
        id: 'payment_methods_modal.save_button.label',
        description: 'Label of the button that stores the payment method being added',
    }),
);

// Named for what it does: while adding from the list it steps back rather than closing.
const cancelButtonText = computed(() =>
    isAddingPaymentMethod.value && openedAt.value === 'LIST'
        ? $t({
              defaultMessage: 'Back',
              id: 'payment_methods_modal.back_button.label',
              description:
                  'Label of the button that leaves adding a payment method for the list of payment methods',
          })
        : $t({
              defaultMessage: 'Close',
              id: 'payment_methods_modal.close_button.label',
              description: 'Label of the button that closes the payment methods modal',
          }),
);
</script>

<template>
    <OnDemandPaymentModalShell
        ref="addPaymentMethodRef"
        class="sv-payment-methods-modal"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-pending="isSaving"
        :panes="PAYMENT_METHODS_MODAL_STEPS"
        :step="step"
        add-payment-method-pane="ADD_PAYMENT_METHOD"
        :customer="customer"
        :payment-method-options="settledOptions"
        :is-payment-method-options-pending="isPaymentMethodOptionsPending"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @payment-success="handlePaymentSuccess"
        @payment-failed="(error) => emit('payment-failed', error)"
    >
        <template #LIST>
            <div class="grid grid-cols-1 gap-4">
                <PaymentMethodsList
                    :payment-methods="paymentMethods"
                    @set-default="emit('changed')"
                    @delete="emit('changed')"
                />
                <Button
                    class="sv-action sv-action--secondary sv-payment-methods-modal__add w-full"
                    intent="secondary"
                    icon-prefix="add"
                    type="button"
                    @click="openAddPaymentMethod"
                    >{{
                        $t({
                            defaultMessage: 'Add payment method',
                            id: 'payment_methods_modal.add_button.label',
                            description:
                                'Label of the button in the payment methods modal that adds a payment method',
                        })
                    }}</Button
                >
            </div>
        </template>

        <!-- The list has nothing to confirm, so it closes with one button rather than two. -->
        <template v-if="!isAddingPaymentMethod" #footer>
            <Button
                size="lg"
                intent="secondary"
                class="sv-action sv-action--secondary sv-payment-methods-modal__close w-full"
                @click="handleCancel"
                >{{ cancelButtonText }}</Button
            >
        </template>
    </OnDemandPaymentModalShell>
</template>
