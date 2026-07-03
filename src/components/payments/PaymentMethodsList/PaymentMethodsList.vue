<script setup lang="ts">
import { Modal, PaymentMethod, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { PaymentMethod as PaymentMethodType } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { PaymentMethodsListEmits, PaymentMethodsListProps } from './PaymentMethodsList.types';
import { usePaymentMethodContextMenuOptions } from '@/composables/usePaymentMethodContextMenuOptions';
import { useSetDefaultPaymentMethod } from '@/composables/useSetDefaultPaymentMethod';

defineProps<PaymentMethodsListProps>();
const emit = defineEmits<PaymentMethodsListEmits>();

const { $t } = useIntl();

const pendingDeletePaymentMethod = ref<PaymentMethodType | null>(null);
const { execute: setDefault } = useSetDefaultPaymentMethod();

const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
    onDeleteRequest: (paymentMethod) => {
        pendingDeletePaymentMethod.value = paymentMethod;
    },
    onSetDefault: async (paymentMethod) => {
        await setDefault(paymentMethod.id);
        emit('set-default', paymentMethod);
    },
});

function handleConfirmDelete() {
    if (pendingDeletePaymentMethod.value) {
        emit('delete', pendingDeletePaymentMethod.value);
    }
    pendingDeletePaymentMethod.value = null;
}
</script>

<template>
    <div v-if="paymentMethods.length > 0" class="sv-payment-methods__list grid grid-cols-1 gap-4">
        <Section
            v-for="paymentMethod in paymentMethods"
            :key="paymentMethod.id"
            class="sv-payment-methods__item"
        >
            <PaymentMethod
                class="sv-payment-methods__item-content"
                :payment-method="paymentMethod"
                :options="getContextMenuItems(paymentMethod)"
            />
        </Section>
    </div>

    <Modal
        :show-modal="!!pendingDeletePaymentMethod"
        :title="
            $t({
                id: 'payment_methods_list.delete_modal.title',
                defaultMessage: 'Delete payment method',
                description: 'Title of the delete payment method confirmation modal',
            })
        "
        :confirm-button-text="
            $t({
                id: 'payment_methods_list.delete_modal.confirm',
                defaultMessage: 'Delete',
                description: 'Confirm button in the delete payment method modal',
            })
        "
        :cancel-button-text="
            $t({
                id: 'payment_methods_list.delete_modal.cancel',
                defaultMessage: 'Cancel',
                description: 'Cancel button in the delete payment method modal',
            })
        "
        @confirm="handleConfirmDelete"
        @close="pendingDeletePaymentMethod = null"
    >
        <template v-if="pendingDeletePaymentMethod" #body>
            <Typography>{{
                $t({
                    id: 'payment_methods_list.delete_modal.body',
                    defaultMessage: 'Are you sure you want to delete this payment method?',
                    description: 'Confirmation message in the delete payment method modal',
                })
            }}</Typography>
            <Section>
                <PaymentMethod :payment-method="pendingDeletePaymentMethod" />
            </Section>
        </template>
    </Modal>
</template>
