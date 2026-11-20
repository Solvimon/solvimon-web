<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    Button,
    CheckboxGroupExtended,
    DividerText,
    ErrorNotification,
    Modal,
    Typography,
    getPaymentAcceptorSubtitle,
    useIntl,
} from '@solvimon/solvimon-ui';
import type { FormFieldError, PaymentAcceptor } from '@solvimon/solvimon-types';
import type {
    PaymentAcceptorsModalEmits,
    PaymentAcceptorsModalProps,
} from './PaymentAcceptorsModal.types';
import PaymentAcceptorForm from '@/components/payments/PaymentAcceptorForm/PaymentAcceptorForm.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import { useLogger } from '@/components/providers';
import { ApiError } from '@/services/apiError';

type Step = 'CHOOSE' | 'ADD';

const PANES = ['CHOOSE', 'ADD'] as const;

const props = defineProps<PaymentAcceptorsModalProps>();
const emit = defineEmits<PaymentAcceptorsModalEmits>();

const { $t } = useIntl();
const logger = useLogger();

const step = ref<Step>('CHOOSE');
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

/** With nothing to choose from, the modal opens on adding one, and cancelling that closes it. */
const opensOnAdding = ref(false);

const goTo = (next: Step) => {
    errorMessage.value = undefined;
    apiError.value = undefined;
    if (next === 'ADD') formKey.value += 1;
    step.value = next;
};

watch(
    () => props.showModal,
    (isShown) => {
        if (!isShown) return;

        const activeIds = new Set(activeAcceptors.value.map(({ id }) => id));
        chosenIds.value = props.subscription.paymentAcceptorIds.filter((id) => activeIds.has(id));

        opensOnAdding.value = activeAcceptors.value.length === 0;
        goTo(opensOnAdding.value ? 'ADD' : 'CHOOSE');
    },
    { immediate: true },
);

const somethingWentWrong = () =>
    $t({
        defaultMessage: 'Something went wrong. Please try again.',
        id: 'payment_acceptors_modal.error',
        description: 'Error shown in the payment acceptors modal when a change cannot be made',
    });

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
        // A refused field is shown at the field; anything else as a message above the form.
        if (error instanceof ApiError && error.field) {
            apiError.value = { [error.field]: error.message };
        } else {
            errorMessage.value = somethingWentWrong();
        }
        return undefined;
    } finally {
        isWorking.value = false;
    }
};

const add = async () => {
    // A second confirm while the first is still being checked would store the acceptor twice.
    if (isWorking.value) return;

    const filledIn = await formRef.value?.submit();

    if (filledIn?.method !== 'CREATE') return;

    const saved = await run(
        () => props.create(filledIn.details),
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
    chosenIds.value = [...chosenIds.value, saved.result.id];
    opensOnAdding.value = false;
    goTo('CHOOSE');
};

const saveChoice = async () => {
    if (isWorking.value) return;

    const saved = await run(
        () => props.saveChoice(chosenIds.value),
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

/** Whether cancelling goes back to choosing rather than closing the modal. */
const isBackStep = computed(() => step.value === 'ADD' && !opensOnAdding.value);

const handleClose = () => {
    if (isWorking.value) return;

    if (isBackStep.value) {
        goTo('CHOOSE');
        return;
    }

    emit('close');
};

const handleConfirm = () => {
    if (step.value === 'ADD') void add();
    else void saveChoice();
};

const title = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Create new payment acceptor',
              id: 'payment_acceptors_modal.create.title',
              description: 'Title of the payment acceptors modal while a new bank account is added',
          })
        : $t({
              defaultMessage: 'Assign payment acceptors',
              id: 'payment_acceptors_modal.assign.title',
              description:
                  'Title of the payment acceptors modal in which the bank accounts of one subscription are chosen',
          }),
);

const confirmButtonText = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Continue',
              id: 'payment_acceptors_modal.create.continue_button.label',
              description:
                  'Label of the button that stores the new bank account and goes back to assigning',
          })
        : $t({
              defaultMessage: 'Assign payment acceptors',
              id: 'payment_acceptors_modal.assign.confirm_button.label',
              description:
                  'Label of the button that stores the bank accounts chosen for the subscription',
          }),
);

const cancelButtonText = computed(() =>
    isBackStep.value
        ? $t({
              defaultMessage: 'Back',
              id: 'payment_acceptors_modal.back_button.label',
              description:
                  'Label of the button that goes back a step in the payment acceptors modal',
          })
        : $t({
              defaultMessage: 'Cancel',
              id: 'payment_acceptors_modal.cancel_button.label',
              description:
                  'Label of the button that closes the payment acceptors modal without saving',
          }),
);

const payerName = computed(
    () =>
        props.subscription.payerName ||
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
        <template #body>
            <div class="sv-payment-acceptors-modal grid grid-cols-1 gap-4 pb-4">
                <ErrorNotification
                    v-if="errorMessage"
                    class="sv-payment-acceptors-modal__error sv-error"
                    :title="errorMessage"
                />

                <SlidingPanes :panes="PANES" :current="step">
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
                                        defaultMessage: 'Select payment acceptors',
                                        id: 'payment_acceptors_modal.assign.label',
                                        description:
                                            'Label of the list of bank accounts to choose for the subscription',
                                    })
                                "
                            />

                            <div class="grid grid-cols-1 gap-2">
                                <DividerText
                                    :text="
                                        $t({
                                            defaultMessage: 'or',
                                            id: 'payment_acceptors_modal.assign.divider_text',
                                            description:
                                                'Between the bank accounts to assign and the button that creates a new one',
                                        })
                                    "
                                />
                                <Button
                                    intent="secondary"
                                    type="button"
                                    class="sv-action sv-action--secondary sv-action--full-width sv-payment-acceptors-modal__add w-full"
                                    :disabled="isWorking"
                                    @click="goTo('ADD')"
                                    >{{
                                        $t({
                                            defaultMessage: 'Create new',
                                            id: 'payment_acceptors_modal.assign.create_button.label',
                                            description:
                                                'Label of the button that moves to the form for a new bank account',
                                        })
                                    }}</Button
                                >
                            </div>
                        </div>
                    </template>

                    <template #ADD>
                        <PaymentAcceptorForm
                            ref="formRef"
                            :key="formKey"
                            :bank-account-title="
                                $t({
                                    defaultMessage: 'Add new bank account',
                                    id: 'payment_acceptors_modal.create.bank_account_title',
                                    description:
                                        'Heading above the bank account fields in the modal that creates a payment acceptor',
                                })
                            "
                            :disabled="isWorking"
                            :api-error="apiError"
                        />
                    </template>
                </SlidingPanes>
            </div>
        </template>
    </Modal>
</template>
