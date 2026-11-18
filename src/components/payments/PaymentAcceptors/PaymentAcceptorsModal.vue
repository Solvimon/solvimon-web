<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Button,
    CheckboxGroupExtended,
    ErrorNotification,
    Modal,
    PaymentAcceptor as PaymentAcceptorRow,
    Section,
    Typography,
    getPaymentAcceptorSubtitle,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { FormFieldError, PaymentAcceptor } from '@solvimon/solvimon-types';
import type {
    PaymentAcceptorsModalEmits,
    PaymentAcceptorsModalProps,
    PaymentAcceptorsModalStart,
} from './PaymentAcceptorsModal.types';
import PaymentAcceptorList from './PaymentAcceptorList.vue';
import PaymentAcceptorForm from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import { useLogger } from '@/components/providers';
import { usePaymentAcceptorMenuItems } from '@/composables/usePaymentAcceptorMenuItems';
import { ApiError } from '@/services/apiError';

type Step = PaymentAcceptorsModalStart['step'];

const PANES = ['LIST', 'CHOOSE', 'FORM', 'DELETE'] as const;

const props = defineProps<PaymentAcceptorsModalProps>();
const emit = defineEmits<PaymentAcceptorsModalEmits>();

const { $t } = useIntl();
const logger = useLogger();

const step = ref<Step>('LIST');
/** The step the modal opened on, which is where closing it is one step back. */
const openedAt = ref<Step>('LIST');
/** The acceptor being edited or deleted. */
const target = ref<PaymentAcceptor>();
const isWorking = ref(false);
const errorMessage = ref<string>();
const apiError = ref<FormFieldError>();
/** The acceptors ticked for the subscription. */
const chosenIds = ref<PaymentAcceptor['id'][]>([]);

const formRef = ref<InstanceType<typeof PaymentAcceptorForm>>();

/**
 * The form is built afresh every time the customer goes to it, so one they gave up on does not
 * come back half filled in.
 */
const formKey = ref(0);

const pane = computed(() => (step.value === 'ADD' || step.value === 'EDIT' ? 'FORM' : step.value));

/** Only an active acceptor is offered to the payer, so only those can be chosen. */
const activeAcceptors = computed(() =>
    props.paymentAcceptors.filter(({ status }) => status === 'ACTIVE'),
);

const choiceOptions = computed(() =>
    activeAcceptors.value.map((paymentAcceptor) => ({
        label: paymentAcceptor.name,
        value: paymentAcceptor.id,
        description: getPaymentAcceptorSubtitle(paymentAcceptor),
    })),
);

/** Choosing has nothing to choose from, so the modal goes straight to adding one instead. */
const isChoosingEmpty = computed(
    () => openedAt.value === 'CHOOSE' && activeAcceptors.value.length === 0,
);

const somethingWentWrong = () =>
    $t({
        defaultMessage: 'Something went wrong. Please try again.',
        id: 'payment_acceptors_modal.error',
        description: 'Error shown in the payment acceptors modal when a change cannot be made',
    });

const goTo = (next: PaymentAcceptorsModalStart) => {
    errorMessage.value = undefined;
    apiError.value = undefined;
    target.value = 'paymentAcceptor' in next ? next.paymentAcceptor : undefined;
    if (next.step === 'ADD' || next.step === 'EDIT') formKey.value += 1;
    step.value = next.step;
};

watch(
    () => props.showModal,
    (isShown) => {
        if (!isShown) return;

        const start = props.start ?? { step: 'LIST' };
        openedAt.value = start.step;

        const activeIds = new Set(activeAcceptors.value.map(({ id }) => id));
        chosenIds.value = (props.subscription?.paymentAcceptorIds ?? []).filter((id) =>
            activeIds.has(id),
        );

        goTo(isChoosingEmpty.value ? { step: 'ADD' } : start);
    },
    { immediate: true },
);

/** The step to go back to: the list or the choice the modal opened on, if it has one. */
const home = computed<'LIST' | 'CHOOSE' | undefined>(() => {
    if (openedAt.value === 'LIST') return 'LIST';
    if (openedAt.value === 'CHOOSE') return 'CHOOSE';
    return undefined;
});

/** Done with an acceptor: back to where the modal opened, unless it was opened for just that. */
const finish = () => {
    if (home.value) {
        goTo({ step: home.value });
        return;
    }

    emit('close');
};

/** The fields the API refused, for the form to show by each; anything else as a message. */
const toFieldError = (error: unknown): FormFieldError =>
    error instanceof ApiError && error.field ? { [error.field]: error.message } : undefined;

/** Runs a change, holding the modal while it is out and saying so when it fails. */
const run = async <T,>(
    change: () => Promise<T>,
    onError: (error: unknown) => void,
): Promise<{ result: T } | undefined> => {
    isWorking.value = true;
    errorMessage.value = undefined;
    apiError.value = undefined;

    try {
        return { result: await change() };
    } catch (error) {
        onError(error);
        apiError.value = toFieldError(error);
        if (!apiError.value) errorMessage.value = somethingWentWrong();
        return undefined;
    } finally {
        isWorking.value = false;
    }
};

const save = async () => {
    // A second confirm while the first is still being checked would store the acceptor twice.
    if (isWorking.value) return;

    const filledIn = await formRef.value?.submit();

    if (!filledIn) return;

    const editing = filledIn.method === 'UPDATE' ? target.value : undefined;

    const saved = await run(
        () =>
            filledIn.method === 'UPDATE' && editing
                ? props.actions.update(editing, filledIn.payload)
                : filledIn.method === 'CREATE'
                  ? props.actions.create(filledIn.details)
                  : Promise.reject(new Error('No payment acceptor to edit')),
        (error) =>
            logger.error(
                'PAYMENT_ACCEPTOR_SAVE_FAILED',
                'Failed to save the payment acceptor',
                {},
                error,
            ),
    );

    if (!saved) return;

    // A new acceptor added while choosing is one the customer means to use for the subscription.
    if (!editing && openedAt.value === 'CHOOSE') {
        chosenIds.value = [...chosenIds.value, saved.result.id];
    }

    // The list has reloaded with the change by now.
    finish();
};

const confirmDelete = async () => {
    const paymentAcceptor = target.value;

    if (!paymentAcceptor || isWorking.value) return;

    const deleted = await run(
        () => props.actions.remove(paymentAcceptor),
        (error) =>
            logger.error(
                'PAYMENT_ACCEPTOR_DELETE_FAILED',
                'Failed to delete the payment acceptor',
                {},
                error,
            ),
    );

    if (!deleted) return;

    chosenIds.value = chosenIds.value.filter((id) => id !== paymentAcceptor.id);
    finish();
};

const saveChoice = async () => {
    if (isWorking.value || !props.saveChoice) return;

    const saved = await run(
        () => props.saveChoice!(chosenIds.value),
        (error) =>
            logger.error(
                'SUBSCRIPTION_PAYMENT_ACCEPTORS_SAVE_FAILED',
                'Failed to save the payment acceptors of the subscription',
                {},
                error,
            ),
    );

    if (saved) emit('close');
};

const { getMenuItems } = usePaymentAcceptorMenuItems({
    onEdit: (paymentAcceptor) => goTo({ step: 'EDIT', paymentAcceptor }),
    onDelete: (paymentAcceptor) => goTo({ step: 'DELETE', paymentAcceptor }),
});

/** Whether cancelling goes back a step rather than closing the modal. */
const isBackStep = computed(
    () => step.value !== openedAt.value && !!home.value && !isChoosingEmpty.value,
);

const handleClose = () => {
    if (isWorking.value) return;

    if (isBackStep.value && home.value) {
        goTo({ step: home.value });
        return;
    }

    emit('close');
};

const handleConfirm = () => {
    if (pane.value === 'FORM') void save();
    if (pane.value === 'DELETE') void confirmDelete();
    if (pane.value === 'CHOOSE') void saveChoice();
};

const title = computed(() => {
    switch (step.value) {
        case 'ADD':
            return $t({
                defaultMessage: 'New payment acceptor',
                id: 'payment_acceptors_modal.add.title',
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
        case 'CHOOSE':
            return $t({
                defaultMessage: 'Choose payment acceptors',
                id: 'payment_acceptors_modal.choose.title',
                description:
                    'Title of the payment acceptors modal in which the bank accounts of one subscription are chosen',
            });
        default:
            return $t({
                defaultMessage: 'Payment acceptors',
                id: 'payment_acceptors_modal.title',
                description:
                    'Title of the modal that lists the bank accounts the customer receives payments on',
            });
    }
});

const confirmButtonText = computed(() => {
    if (pane.value === 'FORM') {
        return $t({
            defaultMessage: 'Save',
            id: 'payment_acceptors_modal.save_button.label',
            description: 'Label of the button that stores a new or changed bank account',
        });
    }

    if (pane.value === 'DELETE') {
        return $t({
            defaultMessage: 'Delete',
            id: 'payment_acceptors_modal.delete_button.label',
            description: 'Label of the button that confirms deleting a bank account',
        });
    }

    if (pane.value === 'CHOOSE') {
        return $t({
            defaultMessage: 'Save',
            id: 'payment_acceptors_modal.choose.save_button.label',
            description:
                'Label of the button that stores the bank accounts chosen for the subscription',
        });
    }

    return undefined;
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

const payerName = computed(
    () =>
        props.subscription?.payerName ||
        $t({
            defaultMessage: 'Your customer',
            id: 'payment_acceptors_modal.payer_fallback',
            description:
                'Stands in for the name of whoever pays the subscription when it is not known',
        }),
);
</script>

<template>
    <Modal
        no-click-away
        full-screen-on-mobile
        size="lg"
        :show-modal="showModal"
        :title="title"
        :confirm-button-text="confirmButtonText"
        :cancel-button-text="cancelButtonText"
        :is-loading="isWorking"
        @confirm="handleConfirm"
        @close="handleClose"
    >
        <!-- The list has nothing to confirm, so it closes with one button rather than two. -->
        <template v-if="step === 'LIST'" #footer>
            <Button
                size="lg"
                intent="secondary"
                class="sv-action sv-action--secondary sv-payment-acceptors-modal__close w-full"
                @click="handleClose"
                >{{ cancelButtonText }}</Button
            >
        </template>

        <template #body>
            <div class="sv-payment-acceptors-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="errorMessage"
                    class="sv-payment-acceptors-modal__error sv-error"
                    :title="errorMessage"
                />

                <SlidingPanes :panes="PANES" :current="pane">
                    <template #LIST>
                        <div class="sv-payment-acceptors-modal__list grid grid-cols-1 gap-4">
                            <Typography variant="body-sm" color="secondary" tag="p" no-spacing>
                                {{
                                    $t({
                                        defaultMessage:
                                            'Bank accounts where you receive payments for your self-billing subscriptions.',
                                        id: 'payment_acceptors_modal.list.description',
                                        description:
                                            'Explains the bank accounts listed in the payment acceptors modal',
                                    })
                                }}
                            </Typography>

                            <PaymentAcceptorList
                                v-if="paymentAcceptors.length"
                                :payment-acceptors="paymentAcceptors"
                                :get-menu-items="getMenuItems"
                            />

                            <EmptyStatePlaceholder
                                v-else-if="!isLoading"
                                class="sv-payment-acceptors-modal__empty"
                                icon="checkbook"
                            >
                                <template #title>
                                    {{
                                        $t({
                                            defaultMessage: 'No payment acceptors yet',
                                            id: 'payment_acceptors_modal.empty.title',
                                            description:
                                                'Shown in the payment acceptors modal when the customer has no bank accounts',
                                        })
                                    }}
                                </template>
                            </EmptyStatePlaceholder>

                            <Button
                                class="sv-action sv-action--secondary sv-action--full-width sv-payment-acceptors-modal__add w-full"
                                intent="secondary"
                                icon-prefix="add"
                                type="button"
                                size="lg"
                                :disabled="isWorking"
                                @click="goTo({ step: 'ADD' })"
                            >
                                {{
                                    $t({
                                        defaultMessage: 'Add payment acceptor',
                                        id: 'payment_acceptors_modal.add_button.label',
                                        description:
                                            'Label of the button that moves to the form for a new bank account',
                                    })
                                }}
                            </Button>
                        </div>
                    </template>

                    <template #CHOOSE>
                        <div class="sv-payment-acceptors-modal__choose grid grid-cols-1 gap-4">
                            <Typography variant="body-sm" color="secondary" tag="p" no-spacing>
                                {{
                                    chosenIds.length
                                        ? $t(
                                              {
                                                  defaultMessage:
                                                      '{payer} pays you into the accounts you choose for this subscription.',
                                                  id: 'payment_acceptors_modal.choose.description',
                                                  description:
                                                      'Explains choosing the bank accounts a self-billing subscription is paid into',
                                              },
                                              { payer: payerName },
                                          )
                                        : $t(
                                              {
                                                  defaultMessage:
                                                      'No specific accounts are chosen for this subscription, so {payer} can pay you into any of your active accounts.',
                                                  id: 'payment_acceptors_modal.choose.none_chosen',
                                                  description:
                                                      'Explains that without a choice every active bank account of the customer applies to the subscription',
                                              },
                                              { payer: payerName },
                                          )
                                }}
                            </Typography>

                            <CheckboxGroupExtended
                                v-model="chosenIds"
                                class="sv-payment-acceptors-modal__choices"
                                name="payment_acceptor_ids"
                                direction="column"
                                :disabled="isWorking"
                                :options="choiceOptions"
                                :label="
                                    $t({
                                        defaultMessage: 'Payment acceptors',
                                        id: 'payment_acceptors_modal.choose.label',
                                        description:
                                            'Label of the list of bank accounts to choose for the subscription',
                                    })
                                "
                            />

                            <button
                                type="button"
                                class="sv-action sv-action--link sv-payment-acceptors-modal__add w-fit rounded text-sm text-primary-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
                                :disabled="isWorking"
                                @click="goTo({ step: 'ADD' })"
                            >
                                {{
                                    $t({
                                        defaultMessage: '+ Add a new payment acceptor',
                                        id: 'payment_acceptors_modal.choose.add_link',
                                        description:
                                            'Link below the bank accounts to choose that moves to the form for a new one',
                                    })
                                }}
                            </button>
                        </div>
                    </template>

                    <template #FORM>
                        <PaymentAcceptorForm
                            ref="formRef"
                            :key="formKey"
                            :payment-acceptor="step === 'EDIT' ? target : undefined"
                            :disabled="isWorking"
                            :api-error="apiError"
                        />
                    </template>

                    <template #DELETE>
                        <div v-if="target" class="grid grid-cols-1 gap-3">
                            <Typography variant="body-sm" color="secondary" tag="p">
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
                            <Section class="sv-payment-acceptors-modal__pending-delete">
                                <PaymentAcceptorRow :payment-acceptor="target" />
                            </Section>
                        </div>
                    </template>
                </SlidingPanes>
            </div>
        </template>
    </Modal>
</template>
