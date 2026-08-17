<script setup lang="ts">
import type { Invoice, WalletBalanceValue } from '@solvimon/solvimon-types';
import {
    Button,
    formatWalletBalanceValue,
    getCustomerCountry,
    Modal,
    RadioGroupExtended,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed, ref, watch } from 'vue';
import type { TopUpModalEmits, TopUpModalProps, TopUpModalStep } from './TopUpModal.types';
import { TOP_UP_MODAL_STEPS } from './TopUpModal.types';
import {
    getTopUpPricingItems,
    getTopUpSubscriptions,
    withTopUpPricingItemsForSchedules,
} from './TopUpModal.lib';
import TopUpModalForm from './TopUpModalForm.vue';
import TopUpModalSuccess from './TopUpModalSuccess.vue';
import { useTopUpModalLabels } from './useTopUpModalLabels';
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.vue';
import { usePaymentMethodOptions } from '@/composables/usePaymentMethodOptions';
import PaymentMethodForm from '@/public/components/PaymentMethodForm/PaymentMethodForm.vue';
import type { TokenizePaymentMethodFormConfiguration } from '@/public/components/PaymentMethodForm/PaymentMethodForm.types';
import EmptyStatePlaceholder from '@/components/checkout/EmptyStatePlaceholder.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';

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
 * Which subscriptions this wallet can be topped up for. A wallet granted by more than one is
 * offered per subscription, since a top-up is charged against one of them and the customer has to
 * say which.
 */
const topUpSubscriptions = computed(() =>
    getTopUpSubscriptions(props.selectedBalanceItem, props.subscriptions ?? []),
);

const selectedSubscriptionId = ref<string | boolean>();

/**
 * Opens on the first, so a top-up is always charged against something the customer can see named.
 * Immediate, since the subscriptions may already be resolved by the time the modal is built.
 */
watch(
    topUpSubscriptions,
    (available) => {
        const chosenIsStillOffered = available.some(
            ({ id }) => id === selectedSubscriptionId.value,
        );

        if (!chosenIsStillOffered) {
            selectedSubscriptionId.value = available[0]?.id;
        }
    },
    { immediate: true },
);

/** Only worth asking when the wallet is topped up through more than one subscription. */
const hasSubscriptionChoice = computed(() => topUpSubscriptions.value.length > 1);

const subscriptionOptions = computed(() =>
    topUpSubscriptions.value.map(({ id, name }) => ({ value: id, label: name })),
);

/**
 * What each row needs to draw itself as a summary: the subscription, and the pricings running on
 * the schedules this wallet is topped up on — the summary's subline, which would otherwise be empty
 * whenever the plan carries no description.
 */
const summaryById = computed(() =>
    Object.fromEntries(
        topUpSubscriptions.value.flatMap(({ id, enabledPricingIds }) => {
            const subscription = (props.subscriptions ?? []).find(({ id: it }) => it === id);

            return subscription ? [[id, { subscription, enabledPricingIds }]] : [];
        }),
    ),
);

/**
 * The balance as the chosen subscription sees it. Narrowed even when there is nothing to choose, so
 * a wallet whose schedules could not be resolved offers nothing rather than everything.
 */
const balanceItemForSubscription = computed(() => {
    // Called without a subscription context there is nothing to narrow by, so the wallet is whole.
    if (!props.selectedBalanceItem || !props.subscriptions?.length) {
        return props.selectedBalanceItem;
    }

    const selected = topUpSubscriptions.value.find(({ id }) => id === selectedSubscriptionId.value);

    // Subscriptions were given but none of them bills this wallet. Offering the whole wallet here
    // would top up against a subscription the caller deliberately left out.
    if (!selected) {
        return { ...props.selectedBalanceItem, charge_on_demand_pricing_items: [] };
    }

    return withTopUpPricingItemsForSchedules(props.selectedBalanceItem, selected.scheduleIds);
});

/**
 * The ways this wallet can be topped up. Flattened here rather than passed raw: the balances field
 * is declared as `PricingItemConfig[]` but carries pricing *items*, so reading `details` off an
 * element type-checks yet is undefined at runtime.
 */
const topUpPricingItems = computed(() => getTopUpPricingItems(balanceItemForSubscription.value));

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

const hasStoredPaymentMethods = computed(() => (props.paymentMethods ?? []).length > 0);

/**
 * Nothing can be added: the gateway offers this customer no way to pay. Only once the options have
 * been fetched — they start out empty, so answering before then says "none available" every time the
 * modal opens.
 */
const hasNoPaymentMethodOptions = computed(
    () => !isPaymentMethodOptionsPending.value && (paymentMethodOptions.value ?? []).length === 0,
);

/**
 * There is no way to pay: nothing stored to charge, and no method the customer could add. Confirming
 * is refused rather than left to fail against the API.
 */
const isTopUpUnavailable = computed(
    () =>
        step.value === 'TOP_UP' &&
        !hasStoredPaymentMethods.value &&
        hasNoPaymentMethodOptions.value,
);

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
 * Every pane stays mounted, but the form is only built once it is first asked for: it starts up a
 * payment gateway, which is not worth doing for a customer who never adds a method.
 */
const hasEverShownForm = ref(false);

watch(step, (currentStep) => {
    hasEverShownForm.value = hasEverShownForm.value || currentStep === 'ADD_PAYMENT_METHOD';
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
                <SlidingPanes :panes="TOP_UP_MODAL_STEPS" :current="step">
                    <!-- top up modal form -->
                    <template #TOP_UP>
                        <div v-if="hasSubscriptionChoice" class="mb-4">
                            <RadioGroupExtended
                                v-model="selectedSubscriptionId"
                                class="sv-topup-modal__subscription"
                                name="top-up-subscription"
                                direction="column"
                                required
                                :options="subscriptionOptions"
                                :show-radio="false"
                                :label="
                                    $t({
                                        defaultMessage: 'Subscription to top up',
                                        description:
                                            'Label above the list of subscriptions a top-up can be charged against, in the top-up modal',
                                        id: 'topup_modal.subscriptions.label',
                                    })
                                "
                            >
                                <template #prefix="{ optionValue }">
                                    <SubscriptionSummary
                                        v-if="summaryById[String(optionValue)]"
                                        class="sv-topup-modal__subscription-option grow"
                                        no-spacing
                                        :subscription="
                                            summaryById[String(optionValue)].subscription
                                        "
                                        :enabled-pricing-ids="
                                            summaryById[String(optionValue)].enabledPricingIds
                                        "
                                    />
                                </template>

                                <template #label="{ option }">
                                    <span class="sr-only">{{ option.label }}</span>
                                </template>
                            </RadioGroupExtended>
                        </div>

                        <TopUpModalForm
                            :key="topUpFormKey"
                            ref="topUpFormRef"
                            :top-up-pricing-items="topUpPricingItems"
                            :payment-methods="paymentMethods"
                            @add-payment-method="step = 'ADD_PAYMENT_METHOD'"
                            @success="handleTopUpSuccess"
                        >
                            <template v-if="isTopUpUnavailable" #payment-method>
                                <EmptyStatePlaceholder
                                    class="sv-topup-modal__payment-methods-empty"
                                    icon="credit_card_off"
                                >
                                    <template #title>
                                        {{
                                            $t({
                                                defaultMessage: 'No payment methods available',
                                                id: 'topup_modal.no_payment_methods_available_title',
                                                description:
                                                    'Shown in the top-up modal when the customer has nothing stored and no method can be added',
                                            })
                                        }}
                                    </template>
                                </EmptyStatePlaceholder>
                            </template>
                        </TopUpModalForm>
                    </template>

                    <!-- payment method add form -->
                    <template #ADD_PAYMENT_METHOD>
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
                    </template>

                    <!-- charged confirmation -->
                    <template #SUCCESS>
                        <TopUpModalSuccess
                            v-if="chargedInvoice"
                            :added-value="chargedValue"
                            :invoice="chargedInvoice"
                        />
                    </template>
                </SlidingPanes>
            </div>
        </template>

        <template v-if="step === 'SUCCESS' || isTopUpUnavailable" #footer>
            <div class="flex flex-col gap-2">
                <Button
                    v-if="step === 'SUCCESS'"
                    size="lg"
                    data-testid="done"
                    @click="handleDone"
                    >{{ confirmButtonText }}</Button
                >

                <template v-else>
                    <Button size="lg" disabled data-testid="confirm">{{
                        confirmButtonText
                    }}</Button>
                    <Button
                        size="lg"
                        color="gray"
                        variant="ghost"
                        data-testid="cancel"
                        @click="handleCancel"
                        >{{ cancelButtonText }}</Button
                    >
                </template>
            </div>
        </template>
    </Modal>
</template>
