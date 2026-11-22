<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    CheckboxGroupExtended,
    ErrorNotification,
    Icon,
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
/** Shown when nothing is ticked: the backend would store that as all of them. */
const choiceError = ref<string>();

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

const activeIds = computed(() => activeAcceptors.value.map(({ id }) => id));

/**
 * Every active acceptor ticked is saved as an empty list, which the backend reads as all of them,
 * including ones added later. That is what the "All payment acceptors" row stands for.
 */
const isAllChosen = computed(
    () => activeIds.value.length > 0 && activeIds.value.every((id) => chosenIds.value.includes(id)),
);

const ALL = 'ALL';

const choiceOptions = computed(() =>
    activeAcceptors.value.map((paymentAcceptor) => ({
        label: paymentAcceptor.name,
        value: paymentAcceptor.id,
        description: getPaymentAcceptorSubtitle(paymentAcceptor),
    })),
);

const allOption = computed(() => [
    {
        label: $t({
            defaultMessage: 'All payment acceptors',
            id: 'payment_acceptors_modal.assign.all.label',
            description:
                'Option that chooses every payment acceptor of the customer for the subscription',
        }),
        value: ALL,
        description: $t({
            defaultMessage: 'Including ones you add later',
            id: 'payment_acceptors_modal.assign.all.description',
            description:
                'Below the option that chooses every payment acceptor: ones added later apply too',
        }),
    },
]);

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

        // An empty list on the subscription means every active acceptor applies.
        chosenIds.value = props.subscription.paymentAcceptorIds.length
            ? props.subscription.paymentAcceptorIds.filter((id) => activeIds.value.includes(id))
            : [...activeIds.value];
        choiceError.value = undefined;

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

    // A new acceptor added while choosing is one the customer means to use, and keeps "all" ticked.
    chosenIds.value = [...chosenIds.value, saved.result.id];
    opensOnAdding.value = false;
    goTo('CHOOSE');
};

const setAllChosen = (values: string[]) => {
    chosenIds.value = values.includes(ALL) ? [...activeIds.value] : [];
    choiceError.value = undefined;
};

const setChosenIds = (ids: PaymentAcceptor['id'][]) => {
    chosenIds.value = ids;
    choiceError.value = undefined;
};

const saveChoice = async () => {
    if (isWorking.value) return;

    if (chosenIds.value.length === 0) {
        choiceError.value = $t({
            defaultMessage: 'Select at least one payment acceptor.',
            id: 'payment_acceptors_modal.assign.none_chosen_error',
            description:
                'Error in the payment acceptors modal when no payment acceptor is ticked for the subscription',
        });
        return;
    }

    const paymentAcceptorIds = isAllChosen.value ? [] : chosenIds.value;
    const saved = await run(
        () => props.saveChoice(paymentAcceptorIds),
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
              defaultMessage: 'New payment acceptor',
              id: 'payment_acceptors_modal.create.new_title',
              description: 'Title of the payment acceptors modal while a new bank account is added',
          })
        : $t({
              defaultMessage: 'Assign payment acceptors',
              id: 'payment_acceptors_modal.assign.title',
              description:
                  'Title of the payment acceptors modal in which the bank accounts of one subscription are chosen',
          }),
);

const subTitle = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Subscriptions that use all payment acceptors will use this one too.',
              id: 'payment_acceptors_modal.create.uses_all_note',
              description:
                  'Subtitle of the step that adds a payment acceptor: subscriptions on use-all payment acceptors get the new one too',
          })
        : undefined,
);

const confirmButtonText = computed(() =>
    step.value === 'ADD'
        ? $t({
              defaultMessage: 'Create',
              id: 'payment_acceptors_modal.create.create_button.label',
              description: 'Label of the button that creates the new payment acceptor',
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
        :sub-title="subTitle"
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
                                    $t(
                                        {
                                            defaultMessage:
                                                'Choose the payment acceptors {payer} can pick from when paying you.',
                                            id: 'payment_acceptors_modal.choose.payer_picks',
                                            description:
                                                'Explains that the payment acceptors chosen for a self-billing subscription are the ones the payer picks from',
                                        },
                                        { payer: payerName },
                                    )
                                }}
                            </Typography>

                            <div class="grid grid-cols-1 gap-2">
                                <CheckboxGroupExtended
                                    :model-value="isAllChosen ? [ALL] : []"
                                    class="sv-payment-acceptors-modal__all"
                                    name="payment_acceptors_all"
                                    direction="column"
                                    required
                                    :disabled="isWorking"
                                    :options="allOption"
                                    :label="
                                        $t({
                                            defaultMessage: 'Select payment acceptors',
                                            id: 'payment_acceptors_modal.assign.label',
                                            description:
                                                'Label of the list of bank accounts to choose for the subscription',
                                        })
                                    "
                                    @update:model-value="setAllChosen"
                                />

                                <CheckboxGroupExtended
                                    :model-value="chosenIds"
                                    class="sv-payment-acceptors-modal__choices pl-6"
                                    name="payment_acceptor_ids"
                                    direction="column"
                                    :disabled="isWorking"
                                    :error="choiceError"
                                    :options="choiceOptions"
                                    @update:model-value="setChosenIds"
                                />

                                <button
                                    type="button"
                                    class="sv-action sv-action--link sv-payment-acceptors-modal__add inline-flex w-fit items-center gap-1 rounded text-sm text-primary-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    :disabled="isWorking"
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
