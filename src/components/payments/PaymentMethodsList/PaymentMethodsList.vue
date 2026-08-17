<script setup lang="ts">
import {
    ErrorNotification,
    Modal,
    PaymentMethod,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { PaymentMethod as PaymentMethodType } from '@solvimon/solvimon-types';
import { ref } from 'vue';
import type { PaymentMethodsListEmits, PaymentMethodsListProps } from './PaymentMethodsList.types';
import { usePaymentMethodContextMenuOptions } from '@/composables/usePaymentMethodContextMenuOptions';
import { usePaymentMethodActions } from '@/composables/usePaymentMethodActions';

defineProps<PaymentMethodsListProps>();
const emit = defineEmits<PaymentMethodsListEmits>();

const { $t } = useIntl();

const pendingDeletePaymentMethod = ref<PaymentMethodType | null>(null);
const { archive, archiveError, isArchiving, setDefault } = usePaymentMethodActions();

const { getContextMenuItems } = usePaymentMethodContextMenuOptions({
    onDeleteRequest: (paymentMethod) => {
        pendingDeletePaymentMethod.value = paymentMethod;
    },
    onSetDefault: async (paymentMethod) => {
        await setDefault(paymentMethod.id);
        emit('set-default', paymentMethod);
    },
});

function handleCloseModal() {
    pendingDeletePaymentMethod.value = null;
    archiveError.value = null;
}

async function handleConfirmDelete() {
    const paymentMethod = pendingDeletePaymentMethod.value;

    if (!paymentMethod || isArchiving.value) return;

    try {
        await archive(paymentMethod.id);
    } catch {
        return;
    }

    emit('delete', paymentMethod);
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
        size="md"
        :show-modal="!!pendingDeletePaymentMethod"
        :is-loading="isArchiving"
        :no-click-away="isArchiving"
        :no-backdrop-close="isArchiving"
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
        @close="handleCloseModal"
    >
        <template v-if="pendingDeletePaymentMethod" #body>
            <div class="sv-payment-methods__delete-modal-body flex flex-col gap-3">
                <Typography
                    variant="body-sm"
                    shade="lighter"
                    tag="p"
                    class="sv-payment-methods__delete-modal-explanation"
                >
                    {{
                        $t({
                            id: 'payment_methods_list.delete_modal.body',
                            defaultMessage: 'Are you sure you want to delete this payment method?',
                            description: 'Confirmation message in the delete payment method modal',
                        })
                    }}
                </Typography>

                <Section no-spacing class="sv-payment-methods__delete-modal-payment-method">
                    <!-- The summary in the cancellation modal brings its own inset; PaymentMethod
                         does not, so it is padded here to sit the same way inside the card. -->
                    <div class="px-3 py-2">
                        <PaymentMethod :payment-method="pendingDeletePaymentMethod" />
                    </div>
                </Section>

                <ErrorNotification
                    v-if="archiveError"
                    class="sv-payment-methods__delete-modal-error sv-error"
                    :title="
                        $t({
                            id: 'payment_methods_list.delete_modal.error',
                            defaultMessage:
                                'We could not delete this payment method. Please try again.',
                            description: 'Error shown when deleting a payment method fails',
                        })
                    "
                />
            </div>
        </template>
    </Modal>
</template>
