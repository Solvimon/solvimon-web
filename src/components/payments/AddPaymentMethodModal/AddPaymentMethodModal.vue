<script setup lang="ts">
import { computed, ref } from 'vue';
import { ErrorNotification, Modal, useIntl } from '@solvimon/solvimon-ui';
import type {
    AddPaymentMethodModalEmits,
    AddPaymentMethodModalProps,
} from './AddPaymentMethodModal.types';
import AddPaymentMethodPane from '@/components/payments/AddPaymentMethodPane/AddPaymentMethodPane.vue';
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';

const props = defineProps<AddPaymentMethodModalProps>();
const emit = defineEmits<AddPaymentMethodModalEmits>();

const { $t } = useIntl();

const paneRef = ref<InstanceType<typeof AddPaymentMethodPane>>();
const isSaving = computed(() => !!paneRef.value?.isSaving);

const hasOptionsLoadFailed = ref(false);

const { settledOptions, isPending } = useCustomerPaymentMethodOptions({
    isOpen: computed(() => props.showModal),
    customer: computed(() => props.customer),
    subscriptionId: computed(() => props.subscription?.id),
    onError: () => {
        hasOptionsLoadFailed.value = true;
    },
});

/** Only the ways the subscription can be paid; without one, whatever the customer can store. */
const paymentMethodOptions = computed(() => {
    const acceptorIds = props.subscription?.payment_acceptor_ids;

    return acceptorIds
        ? settledOptions.value?.filter(({ payment_acceptor }) =>
              acceptorIds.includes(payment_acceptor.id),
          )
        : settledOptions.value;
});

/** The gateway owns a save once it is out, so the customer cannot leave it half done. */
const handleClose = () => {
    if (isSaving.value) return;

    hasOptionsLoadFailed.value = false;
    emit('close');
};
</script>

<template>
    <Modal
        no-click-away
        :show-modal="showModal"
        size="lg"
        :title="
            $t({
                defaultMessage: 'Add payment method',
                id: 'add_payment_method_modal.title',
                description: 'Title of the modal that stores a new payment method',
            })
        "
        :sub-title="
            subTitle ??
            $t({
                defaultMessage: 'Add a new payment method.',
                id: 'add_payment_method_modal.subtitle',
                description:
                    'Shown under the title of the modal that stores a new payment method, when the host says nothing about what it is for',
            })
        "
        :confirm-button-text="
            $t({
                defaultMessage: 'Save payment method',
                id: 'add_payment_method_modal.save_button.label',
                description: 'Label of the button that stores the new payment method',
            })
        "
        :cancel-button-text="
            $t({
                defaultMessage: 'Cancel',
                id: 'add_payment_method_modal.cancel_button.label',
                description: 'Label of the button that closes the modal without storing a method',
            })
        "
        :is-loading="isSaving"
        @confirm="paneRef?.submit()"
        @close="handleClose"
    >
        <template #body>
            <div class="sv-add-payment-method-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="hasOptionsLoadFailed"
                    class="sv-add-payment-method-modal__options-error sv-error"
                    :title="
                        $t({
                            defaultMessage:
                                'We couldn\'t load the ways to add a payment method. Please try again.',
                            id: 'add_payment_method_modal.options_error',
                            description:
                                'Error shown in the modal that stores a new payment method when the ways to pay cannot be loaded',
                        })
                    "
                />

                <AddPaymentMethodPane
                    v-else
                    ref="paneRef"
                    :customer="customer"
                    :payment-method-options="paymentMethodOptions"
                    :is-loading="isPending"
                    :is-active="showModal"
                    @success="emit('stored')"
                    @failure="(error) => emit('failure', error)"
                />
            </div>
        </template>
    </Modal>
</template>
