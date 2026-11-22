<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Button,
    ErrorNotification,
    Icon,
    Modal,
    PaymentAcceptor as PaymentAcceptorRow,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { FormFieldError, PaymentAcceptor } from '@solvimon/solvimon-types';
import {
    PAYMENT_ACCEPTORS_MANAGE_MODAL_STEPS,
    type PaymentAcceptorsManageModalEmits,
    type PaymentAcceptorsManageModalProps,
    type PaymentAcceptorsManageModalStep,
} from './PaymentAcceptorsManageModal.types';
import PaymentAcceptorList from './PaymentAcceptorList.vue';
import PaymentAcceptorForm from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import { useLogger } from '@/components/providers';
import { usePaymentAcceptorMenuItems } from '@/composables/usePaymentAcceptorMenuItems';
import {
    getRefusedShownField,
    isPaymentAcceptorInUse,
} from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.lib';
import { usePaymentAcceptorErrorMessages } from '@/composables/usePaymentAcceptorErrorMessages';

const props = defineProps<PaymentAcceptorsManageModalProps>();
const emit = defineEmits<PaymentAcceptorsManageModalEmits>();

const { $t } = useIntl();
const logger = useLogger();
const { fieldRefused, inUse } = usePaymentAcceptorErrorMessages();

const step = ref<PaymentAcceptorsManageModalStep>('LIST');
/** The step the modal opened on, which is where cancelling closes it rather than going back. */
const openedAt = ref<PaymentAcceptorsManageModalStep>('LIST');
/** The acceptor being edited or deleted. */
const selected = ref<PaymentAcceptor>();

const isWorking = ref(false);
const errorMessage = ref<string>();
const apiError = ref<FormFieldError>();

const formRef = ref<InstanceType<typeof PaymentAcceptorForm>>();
/** Built afresh every time, so a form given up on does not come back half filled in. */
const formKey = ref(0);

const goTo = (next: PaymentAcceptorsManageModalStep, paymentAcceptor?: PaymentAcceptor) => {
    errorMessage.value = undefined;
    apiError.value = undefined;
    selected.value = paymentAcceptor;
    if (next === 'ADD' || next === 'EDIT') formKey.value += 1;
    step.value = next;
};

watch(
    () => props.showModal,
    (isShown) => {
        if (!isShown) return;

        openedAt.value = props.start ?? 'LIST';
        goTo(openedAt.value);
    },
    { immediate: true },
);

const { getMenuItems } = usePaymentAcceptorMenuItems({
    onEdit: (paymentAcceptor) => goTo('EDIT', paymentAcceptor),
    onDelete: (paymentAcceptor) => goTo('DELETE', paymentAcceptor),
});

const isBackStep = computed(() => step.value !== 'LIST' && openedAt.value === 'LIST');

/** Back to the list, where the change shows, unless the modal was opened for just this step. */
const finishStep = () => {
    if (openedAt.value === step.value) {
        emit('close');
        return;
    }
    goTo('LIST');
};

const somethingWentWrong = () =>
    $t({
        defaultMessage: 'Something went wrong. Please try again.',
        id: 'payment_acceptors_modal.error',
        description: 'Error shown in the payment acceptors modal when a change cannot be made',
    });

const save = async () => {
    // A second confirm while the first is still out would store the acceptor twice.
    if (isWorking.value) return;

    const filledIn = await formRef.value?.submit();
    if (!filledIn) return;

    isWorking.value = true;
    errorMessage.value = undefined;
    apiError.value = undefined;

    try {
        if (filledIn.method === 'UPDATE' && selected.value) {
            await props.actions.update(selected.value, filledIn.payload);
        } else if (filledIn.method === 'CREATE') {
            await props.actions.create(filledIn.details);
        }
        finishStep();
    } catch (error) {
        logger.error(
            'PAYMENT_ACCEPTOR_SAVE_FAILED',
            'Failed to save the payment acceptor',
            {},
            error,
        );
        // A refused field is shown at the field; anything else as a message above the form.
        const refusedField = getRefusedShownField(error);
        if (refusedField) {
            apiError.value = { [refusedField]: fieldRefused() };
        } else {
            errorMessage.value = somethingWentWrong();
        }
    } finally {
        isWorking.value = false;
    }
};

const confirmDelete = async () => {
    const paymentAcceptor = selected.value;
    if (!paymentAcceptor || isWorking.value) return;

    isWorking.value = true;
    errorMessage.value = undefined;

    try {
        await props.actions.remove(paymentAcceptor);
        finishStep();
    } catch (error) {
        logger.error(
            'PAYMENT_ACCEPTOR_DELETE_FAILED',
            'Failed to delete the payment acceptor',
            {},
            error,
        );
        errorMessage.value = isPaymentAcceptorInUse(error) ? inUse() : somethingWentWrong();
    } finally {
        isWorking.value = false;
    }
};

const handleConfirm = () => {
    if (step.value === 'ADD' || step.value === 'EDIT') void save();
    else if (step.value === 'DELETE') void confirmDelete();
};

const handleClose = () => {
    if (isWorking.value) return;

    if (isBackStep.value) {
        goTo('LIST');
        return;
    }

    emit('close');
};

const title = computed(() => {
    switch (step.value) {
        case 'ADD':
            return $t({
                defaultMessage: 'New payment acceptor',
                id: 'payment_acceptors_modal.create.new_title',
                description:
                    'Title of the payment acceptors modal while a new bank account is added',
            });
        case 'EDIT':
            return $t({
                defaultMessage: 'Edit payment acceptor',
                id: 'payment_acceptors_modal.edit.title',
                description: 'Title of the payment acceptors modal while a bank account is changed',
            });
        case 'DELETE':
            return $t({
                defaultMessage: 'Delete payment acceptor',
                id: 'payment_acceptors_modal.delete.title',
                description: 'Title of the payment acceptors modal while a delete is confirmed',
            });
        default:
            return $t({
                defaultMessage: 'Payment acceptors',
                id: 'payment_acceptors_modal.manage.title',
                description:
                    'Title of the modal that lists the payment acceptors the customer is paid into',
            });
    }
});

const subTitle = computed(() => {
    if (step.value === 'LIST') {
        return $t({
            defaultMessage: 'Add, edit or delete the payment acceptors you receive payments in.',
            id: 'payment_acceptors_modal.manage.subtitle',
            description:
                'Subtitle of the modal that lists the payment acceptors the customer is paid into',
        });
    }

    return step.value === 'ADD'
        ? $t({
              defaultMessage: 'Subscriptions that use all payment acceptors will use this one too.',
              id: 'payment_acceptors_modal.create.uses_all_note',
              description:
                  'Subtitle of the step that adds a payment acceptor: subscriptions on use-all payment acceptors get the new one too',
          })
        : undefined;
});

const confirmButtonText = computed(() => {
    switch (step.value) {
        case 'ADD':
            return $t({
                defaultMessage: 'Create',
                id: 'payment_acceptors_modal.create.create_button.label',
                description: 'Label of the button that creates the new payment acceptor',
            });
        case 'DELETE':
            return $t({
                defaultMessage: 'Delete',
                id: 'payment_acceptors_modal.delete_button.label',
                description: 'Label of the button that confirms deleting a bank account',
            });
        default:
            return $t({
                defaultMessage: 'Save',
                id: 'payment_acceptors_modal.save_button.label',
                description: 'Label of the button that stores a new or changed bank account',
            });
    }
});

const cancelButtonText = computed(() => {
    if (isBackStep.value) {
        return $t({
            defaultMessage: 'Back',
            id: 'payment_acceptors_modal.back_button.label',
            description: 'Label of the button that goes back a step in the payment acceptors modal',
        });
    }

    return step.value === 'LIST'
        ? $t({
              defaultMessage: 'Close',
              id: 'payment_acceptors_modal.close_button.label',
              description: 'Label of the button that closes the payment acceptors modal',
          })
        : $t({
              defaultMessage: 'Cancel',
              id: 'payment_acceptors_modal.cancel_button.label',
              description:
                  'Label of the button that closes the payment acceptors modal without saving',
          });
});
</script>

<template>
    <Modal
        no-click-away
        full-screen-on-mobile
        size="lg"
        :show-modal="showModal"
        :title="title"
        :sub-title="subTitle"
        :confirm-button-text="confirmButtonText"
        :cancel-button-text="cancelButtonText"
        :is-loading="isWorking"
        @confirm="handleConfirm"
        @close="handleClose"
    >
        <template #body>
            <div class="sv-payment-acceptors-manage-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="errorMessage"
                    class="sv-payment-acceptors-manage-modal__error sv-error"
                    :title="errorMessage"
                />

                <SlidingPanes :panes="PAYMENT_ACCEPTORS_MANAGE_MODAL_STEPS" :current="step">
                    <template #LIST>
                        <div class="grid grid-cols-1 gap-2 pt-2">
                            <Section
                                v-if="paymentAcceptors.length === 0"
                                class="sv-empty-state sv-payment-acceptors-manage-modal__empty"
                            >
                                <Typography variant="body-sm" color="subtle" no-spacing>{{
                                    $t({
                                        defaultMessage: 'You have no payment acceptors yet.',
                                        id: 'payment_acceptors_modal.manage.empty_text',
                                        description:
                                            'Shown in the payment acceptors modal when the customer has no payment acceptors',
                                    })
                                }}</Typography>
                            </Section>
                            <PaymentAcceptorList
                                :payment-acceptors="paymentAcceptors"
                                :get-menu-items="getMenuItems"
                            />
                            <button
                                type="button"
                                class="sv-action sv-action--link sv-payment-acceptors-manage-modal__add inline-flex w-fit items-center gap-1 rounded text-sm text-primary-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                                @click="goTo('ADD')"
                            >
                                <Icon icon="add" size="xs" />
                                {{
                                    $t({
                                        defaultMessage: 'Add a new payment acceptor',
                                        id: 'payment_acceptors_modal.manage.add_button.label',
                                        description:
                                            'Label of the button in the payment acceptors modal that adds a payment acceptor',
                                    })
                                }}
                            </button>
                        </div>
                    </template>

                    <template #ADD>
                        <PaymentAcceptorForm
                            v-if="step === 'ADD'"
                            ref="formRef"
                            :key="formKey"
                            :disabled="isWorking"
                            :api-error="apiError"
                        />
                    </template>

                    <template #EDIT>
                        <PaymentAcceptorForm
                            v-if="step === 'EDIT' && selected"
                            ref="formRef"
                            :key="formKey"
                            :payment-acceptor="selected"
                            :disabled="isWorking"
                            :api-error="apiError"
                        />
                    </template>

                    <template #DELETE>
                        <div
                            v-if="selected"
                            class="sv-payment-acceptors-manage-modal__delete grid grid-cols-1 gap-3"
                        >
                            <Typography variant="body-sm" color="secondary" tag="p" no-spacing>
                                {{
                                    $t({
                                        defaultMessage:
                                            'You will no longer be paid into this bank account.',
                                        id: 'payment_acceptors_modal.delete.message',
                                        description:
                                            'Explains what deleting a bank account does, above the account',
                                    })
                                }}
                            </Typography>
                            <Section>
                                <PaymentAcceptorRow :payment-acceptor="selected" />
                            </Section>
                        </div>
                    </template>
                </SlidingPanes>
            </div>
        </template>

        <!-- The list has nothing to confirm, so it closes with one button rather than two. -->
        <template v-if="step === 'LIST'" #footer>
            <Button
                size="lg"
                intent="secondary"
                class="sv-action sv-action--secondary sv-payment-acceptors-manage-modal__close w-full"
                @click="handleClose"
                >{{ cancelButtonText }}</Button
            >
        </template>
    </Modal>
</template>
