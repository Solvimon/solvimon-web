<script setup lang="ts">
import type { Invoice, WalletBalanceValue } from '@solvimon/solvimon-types';
import {
    Button,
    formatWalletBalanceValue,
    getCustomerCountry,
    Modal,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { TopUpModalEmits, TopUpModalProps, TopUpModalStep } from './TopUpModal.types';
import { TOP_UP_MODAL_STEPS } from './TopUpModal.types';
import { getTopUpPricingItems } from './TopUpModal.lib';
import TopUpModalForm from './TopUpModalForm.vue';
import TopUpModalSuccess from './TopUpModalSuccess.vue';
import { useTopUpModalLabels } from './useTopUpModalLabels';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.vue';
import type { TokenizePaymentMethodFormConfiguration } from '@/public/components/PaymentMethodForm/PaymentMethodForm.types';
import { useElementHeight } from '@/composables/useElementHeight';

const props = defineProps<TopUpModalProps>();
const emit = defineEmits<TopUpModalEmits>();

const { $t, formatNumber } = useIntl();

const currentBalance = computed(() =>
    formatWalletBalanceValue(
        $t,
        formatNumber,
        props.selectedBalanceItem?.wallet_balance.open_balance,
    ),
);

/**
 * The ways this wallet can be topped up. Flattened here rather than passed raw: the balances field
 * is declared as `PricingItemConfig[]` but carries pricing *items*, so reading `details` off an
 * element type-checks yet is undefined at runtime.
 */
const topUpPricingItems = computed(() => getTopUpPricingItems(props.selectedBalanceItem));

const {
    paymentMethodOptions,
    get: loadPaymentMethodOptions,
    isPending: isPaymentMethodOptionsPending,
} = usePaymentMethodOptions();

// Load once the modal is open: the options depend on the customer, so there is nothing to ask
// for while no wallet has been selected.
watch(
    () => [props.showModal, props.customer] as const,
    ([showModal, customer]) => {
        if (!showModal || !customer) {
            return;
        }

        void loadPaymentMethodOptions({
            customerId: customer.id,
            country: getCustomerCountry(customer),
        });
    },
    { immediate: true },
);

/** Which pane is on screen. Every step renames the title, the subtitle and the footer buttons too. */
const step = ref<TopUpModalStep>('TOP_UP');

/**
 * The top-up as it was charged, kept for the success step: the form still holds it, but reading it from
 * there would tie what the receipt says to the form never being touched again.
 */
const chargedInvoice = ref<Invoice>();
const chargedValue = ref<WalletBalanceValue>();

const handlePaymentSuccess = () => {
    // Stored now, so hand the customer back to topping up; the parent reloads the list of methods.
    step.value = 'TOP_UP';
    emit('payment-success');
};

/**
 * Adding a payment method here only stores it — the top-up itself is charged separately, against
 * whichever method is chosen afterwards — so the form runs the tokenization flow.
 */
const paymentMethodFormConfiguration = computed<TokenizePaymentMethodFormConfiguration>(() => ({
    variant: 'TOKENIZE',
}));

/**
 * Both panes stay mounted so the body can animate between their heights, but the form is only built
 * once it is first asked for: it starts up a payment gateway, which is not worth doing for a
 * customer who never adds a method.
 */
const hasEverShownForm = ref(false);

/** How long the panes take to slide past each other, matching the `duration-300` on the track. */
const PANE_TRANSITION_MS = 300;

/**
 * Whether the panes are sliding past each other right now — the only time the body animates its own
 * height.
 *
 * Animating it the rest of the time fights whatever is growing inside: the amount input expands over
 * its own 300ms, every frame of which re-measures the pane and restarts this ease from wherever it had
 * got to. The height then crawls behind its target, clipping the content it is supposed to be
 * revealing, and keeps easing after the input has finished. Outside a switch the measured height is
 * applied straight away instead, so the inner animation is what the customer sees.
 */
const isSwitchingPanes = ref(false);
let switchTimeout: ReturnType<typeof setTimeout> | undefined;

watch(step, (currentStep) => {
    hasEverShownForm.value = hasEverShownForm.value || currentStep === 'ADD_PAYMENT_METHOD';

    isSwitchingPanes.value = true;
    clearTimeout(switchTimeout);
    switchTimeout = setTimeout(() => {
        isSwitchingPanes.value = false;
    }, PANE_TRANSITION_MS);
});

onBeforeUnmount(() => {
    clearTimeout(switchTimeout);
});

const topUpPaneRef = ref<HTMLElement>();
const addPaneRef = ref<HTMLElement>();
const successPaneRef = ref<HTMLElement>();

const paneHeights: Record<TopUpModalStep, Ref<number>> = {
    TOP_UP: useElementHeight(topUpPaneRef),
    ADD_PAYMENT_METHOD: useElementHeight(addPaneRef),
    SUCCESS: useElementHeight(successPaneRef),
};

/**
 * The height the body animates to. A transition cannot run to `auto`, so it tracks whichever pane is
 * on screen — and follows that pane as its own content changes.
 */
const paneHeight = computed(() => paneHeights[step.value].value);

/**
 * The space between panes on the track, matching the `gap-4` that puts it there.
 *
 * It exists so the viewport's sideways clip has something empty to cut: the clip box reaches past the
 * panes by the viewport's own padding — the room a selected option's ring needs — and without a gap
 * that same room shows the edge of the neighbouring pane. Twice the padding leaves the neighbour just
 * out of sight.
 */
const PANE_GAP = '1rem';

/** How far the track has to slide to bring the current pane into view, gaps included. */
const trackOffset = computed(() => {
    const index = TOP_UP_MODAL_STEPS.indexOf(step.value);

    return index === 0 ? 'translateX(0px)' : `translateX(calc(${-index} * (100% + ${PANE_GAP})))`;
});

const paymentMethodFormRef = ref<InstanceType<typeof PaymentMethodForm>>();

/** True while the payment gateway is working, so the confirm button can show it. */
const isSavingPaymentMethod = computed(
    () => step.value === 'ADD_PAYMENT_METHOD' && !!paymentMethodFormRef.value?.isPaymentPending,
);

const topUpFormRef = ref<InstanceType<typeof TopUpModalForm>>();

/** Read back out of the form, which owns the entered amount and the chosen top-up. */
const topUpValue = computed(() => topUpFormRef.value?.chargedValue);

/**
 * A request is out — either storing a payment method or charging the top-up. The confirm button shows
 * it, and the form disables its own inputs while it lasts; nothing else here may be touched either,
 * since the money may already be on its way.
 */
const isPending = computed(() => isSavingPaymentMethod.value || !!topUpFormRef.value?.isCharging);

const { title, subTitle, cancelButtonText, confirmButtonText } = useTopUpModalLabels({
    step,
    currentBalance,
    topUpValue,
});

/**
 * The footer serves every pane: confirming submits whichever form is on screen — the payment method
 * form while adding, otherwise the top-up itself. The success pane replaces the footer outright, so it
 * never gets here.
 */
const handleConfirm = () => {
    if (step.value === 'ADD_PAYMENT_METHOD') {
        paymentMethodFormRef.value?.submit();
        return;
    }

    void topUpFormRef.value?.submit();
};

/** The top-up went through, so the modal moves on to the receipt rather than closing. */
const handleTopUpSuccess = (invoice: Invoice) => {
    chargedInvoice.value = invoice;
    chargedValue.value = topUpFormRef.value?.chargedValue;
    step.value = 'SUCCESS';
};

/**
 * Leaving the success pane, by the Done button or by the close cross. The charge is reported here
 * rather than when it went through: reloading the balance while the customer is still reading the
 * receipt would only redraw what they are looking at, and a wallet takes a moment to reflect the
 * top-up anyway.
 */
const handleDone = () => {
    emit('confirm');
    emit('close');
};

/**
 * While adding a payment method, cancelling steps back to the top-up rather than closing: the
 * customer came here to top up, so the add is a detour rather than the point of the modal. Anywhere
 * else it closes.
 *
 * Note the modal reports its cancel button and its close cross as the same event, so the cross steps
 * back too — they cannot be told apart without replacing the footer.
 */
const handleCancel = () => {
    // The request is already out, so there is nothing left to back out of. The modal cannot disable
    // its own cancel button, so refusing here is what stops the customer walking away mid-charge.
    if (isPending.value) {
        return;
    }

    if (step.value === 'ADD_PAYMENT_METHOD') {
        step.value = 'TOP_UP';
        return;
    }

    if (step.value === 'SUCCESS') {
        handleDone();
        return;
    }

    emit('close');
};

/**
 * Bumped every time the modal opens, to rebuild the top-up form. It is never unmounted, so without
 * this a second visit opens on the last top-up's amount and its invoice preview.
 */
const topUpFormKey = ref(0);

// Reopening starts over: the customer picked a wallet again, not the receipt they last saw.
watch(
    () => props.showModal,
    (showModal) => {
        if (!showModal) {
            return;
        }

        step.value = 'TOP_UP';
        chargedInvoice.value = undefined;
        chargedValue.value = undefined;
        topUpFormKey.value += 1;
    },
);
</script>

<template>
    <Modal
        no-click-away
        :show-modal="showModal"
        size="lg"
        :title="title"
        :sub-title="subTitle"
        :cancel-button-text="cancelButtonText"
        :confirm-button-text="confirmButtonText"
        :is-loading="isPending"
        @confirm="handleConfirm"
        @close="handleCancel"
    >
        <template #body>
            <div class="grid grid-cols-1 gap-4 pb-4">
                <div
                    class="sv-topup-modal__viewport relative -mx-2 overflow-hidden px-2"
                    :class="
                        isSwitchingPanes
                            ? 'transition-[height] duration-300 ease-in-out motion-reduce:transition-none'
                            : ''
                    "
                    :style="paneHeight ? { height: `${paneHeight}px` } : undefined"
                >
                    <div
                        class="sv-topup-modal__track flex items-start gap-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none"
                        :style="{ transform: trackOffset }"
                    >
                        <!-- top up modal form -->
                        <div
                            class="sv-topup-modal__pane w-full shrink-0"
                            :inert="step !== 'TOP_UP' || undefined"
                        >
                            <div ref="topUpPaneRef">
                                <TopUpModalForm
                                    :key="topUpFormKey"
                                    ref="topUpFormRef"
                                    :top-up-pricing-items="topUpPricingItems"
                                    :payment-methods="paymentMethods"
                                    @add-payment-method="step = 'ADD_PAYMENT_METHOD'"
                                    @success="handleTopUpSuccess"
                                />
                            </div>
                        </div>

                        <!-- payment method add form -->
                        <div
                            class="sv-topup-modal__pane w-full shrink-0"
                            :inert="step !== 'ADD_PAYMENT_METHOD' || undefined"
                        >
                            <div ref="addPaneRef">
                                <PaymentMethodForm
                                    v-if="customer && hasEverShownForm"
                                    ref="paymentMethodFormRef"
                                    hide-submit-button
                                    :customer="customer"
                                    :payment-method-options="paymentMethodOptions"
                                    :is-loading="isPaymentMethodOptionsPending"
                                    :configuration="paymentMethodFormConfiguration"
                                    @success="handlePaymentSuccess"
                                    @failure="(error) => $emit('payment-failed', error)"
                                />
                            </div>
                        </div>

                        <!-- charged confirmation -->
                        <div
                            class="sv-topup-modal__pane w-full shrink-0"
                            :inert="step !== 'SUCCESS' || undefined"
                        >
                            <div ref="successPaneRef">
                                <TopUpModalSuccess
                                    v-if="chargedInvoice"
                                    :added-value="chargedValue"
                                    :invoice="chargedInvoice"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!--
            The money is taken by the time this pane is on screen, so there is nothing left to cancel —
            hence one button, which the modal's own footer cannot express.
        -->
        <template v-if="step === 'SUCCESS'" #footer>
            <div class="flex flex-col gap-2">
                <Button size="lg" data-testid="done" @click="handleDone">{{
                    confirmButtonText
                }}</Button>
            </div>
        </template>
    </Modal>
</template>
