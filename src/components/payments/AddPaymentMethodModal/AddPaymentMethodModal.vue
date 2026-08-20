<script setup lang="ts">
import { computed, ref } from 'vue';
import { Modal, useIntl } from '@solvimon/solvimon-ui';
import type {
    AddPaymentMethodModalEmits,
    AddPaymentMethodModalProps,
} from './AddPaymentMethodModal.types';
import AddPaymentMethodPane from '@/components/payments/AddPaymentMethodPane/AddPaymentMethodPane.vue';

defineProps<AddPaymentMethodModalProps>();
const emit = defineEmits<AddPaymentMethodModalEmits>();

const { $t } = useIntl();

/**
 * The form itself, its deferred start-up and the flow it runs are the pane's; this modal is the chrome
 * around it — a title, and a footer that submits it.
 */
const addPaymentMethodRef = ref<InstanceType<typeof AddPaymentMethodPane>>();

/** True while the payment gateway is working, so the confirm button can show it. */
const isSaving = computed(() => !!addPaymentMethodRef.value?.isSaving);

/** The modal owns the submit, so the form's own button is hidden and driven from the footer. */
const handleConfirm = () => {
    addPaymentMethodRef.value?.submit();
};
</script>

<template>
    <Modal
        no-click-away
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
            <AddPaymentMethodPane
                ref="addPaymentMethodRef"
                class="sv-add-payment-method-modal sv-add-payment-method-modal__form"
                :customer="customer"
                :payment-method-options="paymentMethodOptions"
                :is-loading="isLoading"
                :is-active="showModal"
                @success="emit('success')"
                @failure="(error) => emit('failure', error)"
            />
        </template>
    </Modal>
</template>
