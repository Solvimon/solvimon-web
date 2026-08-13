<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Modal, useIntl } from '@solvimon/solvimon-ui';
import type {
    AddPaymentMethodModalEmits,
    AddPaymentMethodModalProps,
} from './AddPaymentMethodModal.types';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.vue';

const props = defineProps<AddPaymentMethodModalProps>();
const emit = defineEmits<AddPaymentMethodModalEmits>();

const { $t } = useIntl();

const paymentMethodFormRef = ref<InstanceType<typeof PaymentMethodForm>>();

/** True while the payment gateway is working, so the confirm button can show it. */
const isSaving = computed(() => Boolean(paymentMethodFormRef.value?.isPaymentPending));

/**
 * The form is only built once the modal is first opened: it starts up a payment gateway, which is
 * not worth doing for a customer who never adds a method.
 */
const hasEverOpened = ref(false);

watch(
    () => props.showModal,
    (showModal) => {
        hasEverOpened.value = hasEverOpened.value || showModal;
    },
    { immediate: true },
);

/** The modal owns the submit, so the form's own button is hidden and driven from the footer. */
const handleConfirm = () => {
    paymentMethodFormRef.value?.submit();
};
</script>

<template>
    <Modal
        no-click-away
        class="sv-add-payment-method-modal"
        size="lg"
        :show-modal="showModal"
        :is-loading="isSaving"
        :title="
            $t({
                defaultMessage: 'Add payment method',
                id: 'add_payment_method_modal.title',
                description: 'Title of the modal for adding a payment method',
            })
        "
        :sub-title="
            $t({
                defaultMessage: 'Add a new payment method to pay with.',
                id: 'add_payment_method_modal.subtitle',
                description: 'Subtitle of the modal for adding a payment method',
            })
        "
        :confirm-button-text="
            $t({
                defaultMessage: 'Save payment method',
                id: 'add_payment_method_modal.confirm_button.label',
                description: 'Label of the button that stores the payment method being added',
            })
        "
        :cancel-button-text="
            $t({
                defaultMessage: 'Cancel',
                id: 'add_payment_method_modal.cancel_button.label',
                description: 'Label of the button that abandons adding a payment method',
            })
        "
        @confirm="handleConfirm"
        @close="emit('close')"
    >
        <template #body>
            <PaymentMethodForm
                v-if="customer && hasEverOpened"
                ref="paymentMethodFormRef"
                hide-submit-button
                class="sv-add-payment-method-modal__form"
                :customer="customer"
                :payment-method-options="paymentMethodOptions"
                :is-loading="isLoading"
                @success="emit('success')"
                @failure="(error) => emit('failure', error)"
            />
        </template>
    </Modal>
</template>
