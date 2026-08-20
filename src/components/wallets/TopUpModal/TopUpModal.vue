<script setup lang="ts">
import type { Invoice, WalletBalanceValue } from '@solvimon/solvimon-types';
import { Button, Modal, RadioGroupExtended, useIntl } from '@solvimon/solvimon-ui';
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
import { useCustomerPaymentMethodOptions } from '@/composables/useCustomerPaymentMethodOptions';
import { useWalletBalanceFormat } from '@/composables/useWalletBalanceFormat';
import AddPaymentMethodPane from '@/components/payments/AddPaymentMethodPane/AddPaymentMethodPane.vue';
import SlidingPanes from '@/components/shared/SlidingPanes/SlidingPanes.vue';
import {
    getActiveAutoTopUpConfig,
    getAutoTopUpChargeTarget,
    toAutoTopUpRule,
    toCreateAutoTopUpConfigPayload,
} from '@/components/wallets/AutoTopUpModal/AutoTopUpModal.lib';
import type { AutoTopUpRule } from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.types';
import { useAddPaymentMethodStep } from '@/composables/useAddPaymentMethodStep';
import { useSaveAutoTopUpConfig } from '@/composables/useSaveAutoTopUpConfig';

const props = defineProps<TopUpModalProps>();
const emit = defineEmits<TopUpModalEmits>();

const { $t } = useIntl();
const { formatOpenBalance } = useWalletBalanceFormat();

const savedAutoTopUpRule = computed(() =>
    toAutoTopUpRule(getActiveAutoTopUpConfig(props.selectedBalanceItem)),
);

const currentBalance = computed(() => formatOpenBalance(props.selectedBalanceItem));

const topUpSubscriptions = computed(() =>
    getTopUpSubscriptions(props.selectedBalanceItem, props.subscriptions ?? []),
);

const selectedSubscriptionId = ref<string | boolean>();

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

const hasSubscriptionChoice = computed(() => topUpSubscriptions.value.length > 1);

const subscriptionOptions = computed(() =>
    topUpSubscriptions.value.map(({ id, name }) => ({ value: id, label: name })),
);

const summaryById = computed(() =>
    Object.fromEntries(
        topUpSubscriptions.value.flatMap(({ id, enabledPricingIds }) => {
            const subscription = (props.subscriptions ?? []).find(({ id: it }) => it === id);

            return subscription ? [[id, { subscription, enabledPricingIds }]] : [];
        }),
    ),
);

const balanceItemForSubscription = computed(() => {
    if (!props.selectedBalanceItem || !props.subscriptions?.length) {
        return props.selectedBalanceItem;
    }

    const selected = topUpSubscriptions.value.find(({ id }) => id === selectedSubscriptionId.value);

    if (!selected) {
        return { ...props.selectedBalanceItem, charge_on_demand_pricing_items: [] };
    }

    return withTopUpPricingItemsForSchedules(props.selectedBalanceItem, selected.scheduleIds);
});

const topUpPricingItems = computed(() => getTopUpPricingItems(balanceItemForSubscription.value));

const {
    paymentMethodOptions,
    settledOptions,
    isPending: isPaymentMethodOptionsPending,
} = useCustomerPaymentMethodOptions({
    isOpen: computed(() => props.showModal),
    customer: computed(() => props.customer),
});

const step = ref<TopUpModalStep>('TOP_UP');

const hasStoredPaymentMethods = computed(() => (props.paymentMethods ?? []).length > 0);

const hasNoPaymentMethodOptions = computed(
    () => !isPaymentMethodOptionsPending.value && (paymentMethodOptions.value ?? []).length === 0,
);

const isTopUpUnavailable = computed(
    () =>
        step.value === 'TOP_UP' &&
        !hasStoredPaymentMethods.value &&
        hasNoPaymentMethodOptions.value,
);

/** Kept here rather than read off the form, which the customer may touch again. */
const chargedInvoice = ref<Invoice>();
const chargedValue = ref<WalletBalanceValue>();

const handlePaymentSuccess = () => {
    leaveAddPaymentMethod();
    emit('payment-success');
};

const {
    paneRef: addPaymentMethodRef,
    isActive: isAddingPaymentMethod,
    isSaving: isSavingPaymentMethod,
    open: openAddPaymentMethod,
    leave: leaveAddPaymentMethod,
    submit: submitPaymentMethod,
} = useAddPaymentMethodStep({ step, name: 'ADD_PAYMENT_METHOD', returnTo: 'TOP_UP' });

const { save: saveRule } = useSaveAutoTopUpConfig();

const topUpFormRef = ref<InstanceType<typeof TopUpModalForm>>();

const topUpValue = computed(() => topUpFormRef.value?.chargedValue);

const isPending = computed(() => isSavingPaymentMethod.value || !!topUpFormRef.value?.isCharging);

const { title, subTitle, cancelButtonText, confirmButtonText } = useTopUpModalLabels({
    step,
    currentBalance,
    topUpValue,
});

const handleConfirm = () => {
    if (isAddingPaymentMethod.value) {
        submitPaymentMethod();
        return;
    }

    void topUpFormRef.value?.submit();
};

/**
 * Billed against the wallet's choose-your-amount item rather than whichever pack was bought — the
 * only kind a rule can charge. The money is already taken, so a failed save is reported, not raised.
 */
const handleSaveAutoTopUp = async ({
    rule,
    paymentMethodId,
}: {
    rule: AutoTopUpRule;
    paymentMethodId: string;
}) => {
    const { saved } = await saveRule(
        toCreateAutoTopUpConfigPayload({
            rule,
            walletBalanceItem: props.selectedBalanceItem,
            chargeTarget: getAutoTopUpChargeTarget(undefined, topUpPricingItems.value),
            paymentMethodId,
        }),
    );

    if (saved) {
        emit('auto-top-up-saved');
    }
};

const handleTopUpSuccess = (invoice: Invoice) => {
    chargedInvoice.value = invoice;
    chargedValue.value = topUpFormRef.value?.chargedValue;
    step.value = 'SUCCESS';
};

/** Reported on the way out, so the balance is not reloaded under a receipt still being read. */
const handleDone = () => {
    emit('confirm');
    emit('close');
};

const handleCancel = () => {
    if (isPending.value) {
        return;
    }

    if (isAddingPaymentMethod.value) {
        leaveAddPaymentMethod();
        return;
    }

    if (step.value === 'SUCCESS') {
        handleDone();
        return;
    }

    emit('close');
};

const topUpFormKey = ref(0);

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
                            :auto-top-up-config="savedAutoTopUpRule"
                            :payment-method-options="settledOptions"
                            @add-payment-method="openAddPaymentMethod"
                            @success="handleTopUpSuccess"
                            @save-auto-top-up="handleSaveAutoTopUp"
                        />
                    </template>

                    <template #ADD_PAYMENT_METHOD>
                        <AddPaymentMethodPane
                            ref="addPaymentMethodRef"
                            :customer="customer"
                            :payment-method-options="paymentMethodOptions"
                            :is-loading="isPaymentMethodOptionsPending"
                            :is-active="isAddingPaymentMethod"
                            @success="handlePaymentSuccess"
                            @failure="(error) => $emit('payment-failed', error)"
                        />
                    </template>
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
