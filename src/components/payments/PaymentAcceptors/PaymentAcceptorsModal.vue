<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    CheckboxGroupExtended,
    ErrorNotification,
    Icon,
    Modal,
    Toggle,
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
/**
 * Whether the subscription uses all of the customer's active acceptors, including ones added
 * later. The backend stores this as an empty list; the toggle is how the customer sees it.
 */
const usesAll = ref(true);
/** The acceptors ticked while the toggle is off; kept when the toggle goes back on until saved. */
const chosenIds = ref<PaymentAcceptor['id'][]>([]);
/** Shown when the toggle is off and nothing is ticked: saving that would mean all of them. */
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

/** With the toggle on every active acceptor shows ticked, since every one of them applies. */
const tickedIds = computed(() => (usesAll.value ? activeIds.value : chosenIds.value));

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

        usesAll.value = props.subscription.paymentAcceptorIds.length === 0;
        chosenIds.value = props.subscription.paymentAcceptorIds.filter((id) =>
            activeIds.value.includes(id),
        );
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

    // With the toggle on the new acceptor already applies; with it off, the customer means to use it.
    if (!usesAll.value) chosenIds.value = [...chosenIds.value, saved.result.id];
    opensOnAdding.value = false;
    goTo('CHOOSE');
};

const setUsesAll = (value: boolean) => {
    usesAll.value = value;
    choiceError.value = undefined;
    // Turning it off starts from what was on screen: every acceptor ticked.
    if (!value && chosenIds.value.length === 0) chosenIds.value = [...activeIds.value];
};

const setChosenIds = (ids: PaymentAcceptor['id'][]) => {
    chosenIds.value = ids;
    choiceError.value = undefined;
};

const saveChoice = async () => {
    if (isWorking.value) return;

    if (!usesAll.value && chosenIds.value.length === 0) {
        choiceError.value = $t({
            defaultMessage: 'Select at least one payment acceptor, or turn on Use all.',
            id: 'payment_acceptors_modal.assign.none_selected_error',
            description:
                'Error in the payment acceptors modal when the use-all toggle is off and no payment acceptor is ticked',
        });
        return;
    }

    const paymentAcceptorIds = usesAll.value ? [] : chosenIds.value;
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

                            <Toggle
                                :model-value="usesAll"
                                no-spacing
                                label-position="before"
                                class="sv-payment-acceptors-modal__use-all !flex"
                                :disabled="isWorking"
                                @update:model-value="setUsesAll"
                            >
                                <template #inline-label>
                                    <div class="flex grow flex-col">
                                        <Typography tag="span" variant="body-sm">{{
                                            $t({
                                                defaultMessage: 'Use all payment acceptors',
                                                id: 'payment_acceptors_modal.use_all.label',
                                                description:
                                                    'Label of the toggle that lets a self-billing subscription use every active payment acceptor of the customer',
                                            })
                                        }}</Typography>
                                        <Typography tag="span" variant="body-xs" color="subtle">{{
                                            $t({
                                                defaultMessage: 'Includes any you add later.',
                                                id: 'payment_acceptors_modal.use_all.description',
                                                description:
                                                    'Below the use-all toggle: payment acceptors added later also apply to the subscription',
                                            })
                                        }}</Typography>
                                    </div>
                                </template>
                            </Toggle>

                            <div class="grid grid-cols-1 gap-2">
                                <CheckboxGroupExtended
                                    :model-value="tickedIds"
                                    class="sv-payment-acceptors-modal__choices"
                                    name="payment_acceptor_ids"
                                    direction="column"
                                    :disabled="usesAll || isWorking"
                                    :error="choiceError"
                                    :options="choiceOptions"
                                    :label="
                                        $t({
                                            defaultMessage: 'Select payment acceptors',
                                            id: 'payment_acceptors_modal.assign.label',
                                            description:
                                                'Label of the list of bank accounts to choose for the subscription',
                                        })
                                    "
                                    @update:model-value="setChosenIds"
                                />

                                <button
                                    type="button"
                                    class="sv-action sv-action--link sv-payment-acceptors-modal__add flex w-full items-center gap-1 rounded border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-primary-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    :disabled="isWorking"
                                    @click="goTo('ADD')"
                                >
                                    <Icon icon="add" size="xs" />
                                    {{
                                        $t({
                                            defaultMessage: 'Add payment acceptor',
                                            id: 'payment_acceptors_modal.assign.add_button.label',
                                            description:
                                                'Label of the last row in the list of payment acceptors, which opens the form for a new bank account',
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
