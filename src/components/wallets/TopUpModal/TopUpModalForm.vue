<script setup lang="ts">
import type { Amount, PaymentMethod, WalletBalanceValue } from '@solvimon/solvimon-types';
import { computed, reactive, ref, watch } from 'vue';
import { helpers, required } from '@vuelidate/validators';
import {
    Expand,
    formatAmount,
    RadioGroupExtended,
    Typography,
    useIntl,
    useValidation,
    Divider,
} from '@solvimon/solvimon-ui';
import {
    type TopUpModalFormEmits,
    type TopUpModalFormProps,
    type TopUpModalFormState,
} from './TopUpModalForm.types';
import TopUpInvoicePreview from './TopUpInvoicePreview.vue';
import {
    getAutoTopUpCreditUnitName,
    getAutoTopUpEditorConfig,
    getTopUpValue,
    type FlexibleTopUpPricing,
    type TopUpPricingItem,
} from './TopUpModal.lib';
import AutoTopUpConfigEditor from '@/components/wallets/AutoTopUpConfig/AutoTopUpConfig.vue';
import ConvertedAmountInput from '@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';
import { useDefaultPaymentMethod } from '@/composables/useDefaultPaymentMethod';
import { useWalletBalanceFormat } from '@/composables/useWalletBalanceFormat';
import { createInvoicesService } from '@/services/invoices';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<TopUpModalFormProps>();
const emit = defineEmits<TopUpModalFormEmits>();

const { $t } = useIntl();

const { formatValue } = useWalletBalanceFormat();

const model = ref<TopUpModalFormState>({
    pricing_plan_schedule_id: '',
    pricing_items: [],
    start_at: '',
    finalize_immediately: false,
    payment_method_id: undefined,
    preview: true,
});

/**
 * Choose-your-own-amount first, since that is the option that opens selected. A stable partition, so
 * the fixed packs keep the order they arrive in.
 */
const chargeableItems = computed(() => {
    const chargeable = (props.topUpPricingItems ?? []).filter(
        (item) => item.flexiblePricing || item.fixedPricing,
    );

    return [
        ...chargeable.filter(({ flexiblePricing }) => flexiblePricing),
        ...chargeable.filter(({ flexiblePricing }) => !flexiblePricing),
    ];
});

const findItem = (pricingItemId?: string) =>
    chargeableItems.value.find((item) => item.pricingItemId === pricingItemId);

/**
 * The top-up is charged on the schedule the pricing item is billed on — the wallet balance itself
 * does not say which that is.
 */
const pricingPlanScheduleId = computed(
    () =>
        props.topUpPricingItems?.find((item) => item.pricingPlanScheduleId)?.pricingPlanScheduleId,
);

// The payload is submitted as-is, so keep its copy current as the pricing items arrive.
watch(
    pricingPlanScheduleId,
    (scheduleId) => {
        model.value.pricing_plan_schedule_id = scheduleId ?? '';
    },
    { immediate: true },
);

/**
 * The amount a choose-your-amount top-up starts at, matching what its input would seed itself with.
 *
 * The input only seeds on the render it is first built in, and it is built once and then kept — so
 * choosing another option and coming back would find it empty without this.
 */
const getInitialAmount = (item: TopUpPricingItem): Amount | undefined => {
    const { config, currency } = item.flexiblePricing ?? {};
    const minimum = config?.minimum_amount;

    return minimum && currency ? { quantity: minimum.quantity, currency } : undefined;
};

/**
 * Which top-up is chosen. Read from and written to the payload rather than tracked alongside it, so
 * the charge and the selection can never disagree. Only one may be picked, hence a single entry.
 */
const selectedPricingItemId = computed<string | boolean | undefined>({
    get: () => model.value.pricing_items[0]?.pricing_item_id,
    set: (value) => {
        const item = findItem(typeof value === 'string' ? value : undefined);

        if (!item) {
            model.value.pricing_items = [];
            return;
        }

        const initialAmount = getInitialAmount(item);

        model.value.pricing_items = [
            {
                pricing_item_id: item.pricingItemId,
                ...(initialAmount && { flexible_amount: initialAmount }),
            },
        ];
    },
});

/**
 * Opens on a top-up already chosen, so the customer never has to make a first pick before seeing
 * what a top-up would cost.
 */
watch(
    chargeableItems,
    (items) => {
        const chosenIsStillOffered = items.some(
            ({ pricingItemId }) => pricingItemId === model.value.pricing_items[0]?.pricing_item_id,
        );

        if (chosenIsStillOffered) {
            return;
        }

        const preferred = items.find(({ flexiblePricing }) => flexiblePricing) ?? items[0];

        selectedPricingItemId.value = preferred?.pricingItemId;
    },
    { immediate: true },
);

/** The amount entered for the chosen top-up, when it is a choose-your-amount one. */
const flexibleAmount = computed<Amount | undefined>({
    get: () => model.value.pricing_items[0]?.flexible_amount,
    set: (amount) => {
        const pricingItemId = model.value.pricing_items[0]?.pricing_item_id;

        if (!pricingItemId) {
            return;
        }

        // Rebuilt rather than spread, so clearing the input really drops the amount.
        model.value.pricing_items = [
            { pricing_item_id: pricingItemId, ...(amount && { flexible_amount: amount }) },
        ];
    },
});

/**
 * What a fixed top-up costs, shown to the right of what it grants. Only for a credit based wallet:
 * elsewhere the option is already labelled with this very amount, and repeating it reads as a bug.
 */
const getCostLabel = (optionValue: string | boolean) => {
    const fixedPricing = findItem(String(optionValue))?.fixedPricing;

    return fixedPricing?.value.credits ? formatAmount(fixedPricing.amount) : undefined;
};

/**
 * The flexible pricing for one option, as a zero-or-one list so the template can bind it as a
 * narrowed local through `v-for`. Per option rather than "the selected one", so the input keeps its
 * config while the row is collapsing rather than blanking the moment the choice moves elsewhere.
 */
const selectedFlexiblePricing = computed(
    () => findItem(String(selectedPricingItemId.value))?.flexiblePricing,
);

/** The field hands back a bare quantity, so the currency it is charged in is put back on here. */
const flexibleAmountQuantity = computed<string>({
    get: () => flexibleAmount.value?.quantity ?? '',
    set: (quantity) => {
        const currency = selectedFlexiblePricing.value?.currency;

        flexibleAmount.value = quantity && currency ? { quantity, currency } : undefined;
    },
});

const entryBaseFor = (pricing: Omit<FlexibleTopUpPricing, 'pricingItemId'>) =>
    pricing.creditsConfiguration ? ('CREDITS' as const) : ('AMOUNT' as const);

/** Read off the wallet: the name lives on the credit type, not on the pricing's conversion config. */
const creditUnitName = computed(() => getAutoTopUpCreditUnitName(props.topUpPricingItems));

const entryUnitFor = (pricing: Omit<FlexibleTopUpPricing, 'pricingItemId'>) =>
    pricing.creditsConfiguration
        ? (creditUnitName.value ??
          pricing.creditsConfiguration.unitNamePlural ??
          pricing.creditsConfiguration.unitNameSingle ??
          '')
        : pricing.currency;

const flexiblePricingFor = (optionValue: string | boolean) => {
    const flexiblePricing = findItem(String(optionValue))?.flexiblePricing;

    return flexiblePricing ? [flexiblePricing] : [];
};

/**
 * Whether an option is the choose-your-amount one. Its description says what the amount input accepts,
 * so it belongs inside the panel that expands with the input rather than above it — everything else
 * keeps its description on show at all times.
 */
const isFlexibleOption = (optionValue: string | boolean) =>
    !!findItem(String(optionValue))?.flexiblePricing;

const options = computed(() =>
    chargeableItems.value.map((item) => ({
        value: item.pricingItemId,
        label: item.fixedPricing
            ? formatValue(item.fixedPricing.value)
            : $t({
                  defaultMessage: 'Choose your own amount',
                  description: 'Label of the choose-your-amount option in the top-up modal',
                  id: 'topup_modal.flexible_option.label',
              }),
        ...(item.flexiblePricing?.bounds.minimum &&
            item.flexiblePricing.bounds.maximum && {
                description: $t(
                    {
                        defaultMessage: 'Between {minimum} and {maximum}',
                        description: 'Bounds of the choose-your-amount option in the top-up modal',
                        id: 'topup_modal.flexible_option.bounds',
                    },
                    {
                        minimum: formatValue(item.flexiblePricing.bounds.minimum),
                        maximum: formatValue(item.flexiblePricing.bounds.maximum),
                    },
                ),
            }),
    })),
);

// A chosen flexible top-up is not chargeable until an amount is entered, so it previews only then.
const pricingItems = computed(() => {
    const chargeable = model.value.pricing_items.filter(
        (item) => !findItem(item.pricing_item_id)?.flexiblePricing || !!item.flexible_amount,
    );

    return chargeable.length > 0 ? chargeable : undefined;
});

/**
 * Nothing unless the wallet offers a choose-your-amount top-up — the only kind a rule can charge —
 * and has no rule yet, an existing one being the auto top-up modal's to change.
 */
const autoTopUpEditor = computed(() => {
    const canSetUpAutoTopUp =
        !props.autoTopUpConfig &&
        chargeableItems.value.some(({ flexiblePricing }) => flexiblePricing);

    return canSetUpAutoTopUp ? getAutoTopUpEditorConfig(props.topUpPricingItems) : undefined;
});

const autoTopUpFormRef = ref<InstanceType<typeof AutoTopUpConfigEditor>>();

const { chargeOnDemandPricingItems } = createInvoicesService();
const logger = useLogger();

const isCharging = ref(false);

/**
 * Everything a charge needs: the schedule it is billed on — which is the chosen subscription, where
 * there is a choice — a top-up with an amount to it, and a method to pay with.
 */
const canSubmit = computed(
    () =>
        !!model.value.pricing_plan_schedule_id &&
        !!pricingItems.value &&
        !!model.value.payment_method_id,
);

/**
 * A top-up cannot be charged to nothing, so the method is validated rather than merely guarded:
 * confirming with none chosen puts the error under the selector instead of doing nothing at all.
 */
const validationState = reactive({
    paymentMethodId: computed(() => model.value.payment_method_id ?? null),
});

const validation = useValidation(
    {
        paymentMethodId: {
            required: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'Select a payment method to pay for this top-up.',
                        description:
                            'Error shown under the payment methods in the top-up modal when none is selected on submit',
                        id: 'topup_modal.payment_method_required',
                    }),
                required,
            ),
        },
    },
    validationState,
);

/**
 * What the chosen top-up adds to the wallet, read by the modal for its confirm button and its success
 * step. Credits for a credit based wallet, money otherwise — the customer's own terms either way.
 */
const chargedValue = computed<WalletBalanceValue | undefined>(() => {
    const [chargedItem] = model.value.pricing_items;
    const item = findItem(chargedItem?.pricing_item_id);

    return item ? getTopUpValue(item, chargedItem?.flexible_amount) : undefined;
});

/**
 * Charges the chosen top-up. Driven from the modal footer, which owns the confirm button — hence the
 * exposed handle rather than a button of its own.
 */
async function submit() {
    // Touched rather than awaited: `$validate()` is a promise, and yielding before the guard below
    // would let a second press through while the first was still validating.
    validation.value.$touch();

    // Confirmed by the same button, so it is touched either way and says why it cannot be saved.
    const editedAutoTopUp = autoTopUpFormRef.value?.validate();

    if (
        validation.value.$invalid ||
        autoTopUpFormRef.value?.isInvalid ||
        !canSubmit.value ||
        isCharging.value
    ) {
        return;
    }

    isCharging.value = true;

    try {
        // Spelled out rather than spread from the model: that carries the preview request's
        // defaults — `preview: true`, an empty `start_at`, and a `finalize_immediately: false` that
        // would override the service's own `true` and leave the invoice unpaid.
        const invoice = await chargeOnDemandPricingItems({
            pricing_plan_schedule_id: model.value.pricing_plan_schedule_id,
            pricing_items: pricingItems.value ?? [],
            payment_method_id: model.value.payment_method_id,
            preview: false,
        });

        // Only a rule the customer changed: every top-up would otherwise re-save the one it opened on.
        if (
            editedAutoTopUp &&
            autoTopUpFormRef.value?.hasChanges &&
            model.value.payment_method_id
        ) {
            emit('save-auto-top-up', {
                rule: editedAutoTopUp,
                paymentMethodId: model.value.payment_method_id,
            });
        }

        emit('success', invoice);
    } catch (error) {
        logger.error('TOP_UP_FAILED', 'Failed to charge the wallet top-up', {}, error);
        emit('failure', error);
    } finally {
        isCharging.value = false;
    }
}

defineExpose({ submit, isCharging, canSubmit, chargedValue });

const selectedPaymentMethodId = computed<PaymentMethod['id'] | undefined>({
    get: () => model.value.payment_method_id ?? undefined,
    set: (paymentMethodId) => {
        model.value.payment_method_id = paymentMethodId;
    },
});

const { sortedPaymentMethods } = useDefaultPaymentMethod({
    paymentMethods: computed(() => props.paymentMethods),
    selectedPaymentMethodId,
});
</script>

<template>
    <form class="sv-top-up-form">
        <div class="grid grid-cols-1 gap-4">
            <div class="grid grid-cols-1 gap-1">
                <!-- top up amount -->
                <RadioGroupExtended
                    v-if="options.length > 0"
                    v-model="selectedPricingItemId"
                    class="sv-top-up-form__options"
                    name="top-up-pricing-item"
                    direction="column"
                    required
                    :disabled="isCharging"
                    :options="options"
                    :show-radio="false"
                    :label="
                        $t({
                            defaultMessage: 'Top up amount',
                            description:
                                'Label above the list of ways to top up the wallet in the top-up modal',
                            id: 'topup_modal.pricing_items.label',
                        })
                    "
                >
                    <template #label="{ option, optionValue }">
                        <span>{{ option.label }}</span>

                        <Typography
                            v-if="getCostLabel(optionValue)"
                            tag="span"
                            variant="body-sm"
                            shade="lighter"
                            weight="normal"
                            no-spacing
                            class="sv-top-up-form__option-cost"
                            >{{ getCostLabel(optionValue) }}</Typography
                        >
                    </template>

                    <template #description="{ option, optionValue }">
                        <div class="sv-top-up-form__option-details">
                            <Typography
                                v-if="option.description && !isFlexibleOption(optionValue)"
                                tag="span"
                                variant="body-xs"
                                shade="lighter"
                                no-spacing
                                >{{ option.description }}</Typography
                            >
                            <Expand
                                v-if="flexiblePricingFor(optionValue).length > 0"
                                :is-open="String(optionValue) === selectedPricingItemId"
                                lazy
                            >
                                <div
                                    v-for="flexiblePricing in flexiblePricingFor(optionValue)"
                                    :key="flexiblePricing.currency"
                                    class="sv-top-up-form__amount grid grid-cols-1 gap-3"
                                    @click.stop
                                    @keydown.stop
                                >
                                    <Typography
                                        v-if="option.description"
                                        tag="span"
                                        variant="body-xs"
                                        shade="lighter"
                                        no-spacing
                                        >{{ option.description }}</Typography
                                    >
                                    <ConvertedAmountInput
                                        v-model="flexibleAmountQuantity"
                                        name="top-up-amount"
                                        model-base="AMOUNT"
                                        :unit="entryUnitFor(flexiblePricing)"
                                        :entry-base="entryBaseFor(flexiblePricing)"
                                        :currency="flexiblePricing.currency"
                                        :conversion-rate="
                                            flexiblePricing.creditsConfiguration?.conversionRate
                                        "
                                        required
                                        :disabled="isCharging"
                                    />
                                </div>
                            </Expand>
                        </div>
                    </template>
                </RadioGroupExtended>
            </div>

            <div>
                <TopUpInvoicePreview
                    :pricing-plan-schedule-id="pricingPlanScheduleId"
                    :pricing-items="pricingItems"
                />
            </div>

            <div v-if="autoTopUpEditor">
                <AutoTopUpConfigEditor
                    ref="autoTopUpFormRef"
                    class="sv-top-up-form__auto-top-up"
                    v-bind="autoTopUpEditor"
                    contained
                    :show-threshold-conversion="false"
                    :disabled="isCharging"
                />
            </div>

            <!-- divider -->
            <div>
                <Divider spacing="xs" />
            </div>

            <!-- payment methods -->
            <div>
                <slot name="payment-method">
                    <PaymentMethodSelector
                        v-model="selectedPaymentMethodId"
                        class="sv-top-up-form__payment-methods"
                        :payment-methods="sortedPaymentMethods"
                        required
                        :error="validation.paymentMethodId.$errors"
                        :payment-method-options="paymentMethodOptions"
                        :disabled="isCharging"
                        :label="
                            $t({
                                defaultMessage: 'Payment method',
                                description:
                                    'Label above the payment method that pays for the top-up, in the top-up modal',
                                id: 'topup_modal.payment_method_selector.label',
                            })
                        "
                        @add-payment-method="emit('add-payment-method')"
                    />
                </slot>
            </div>
        </div>
    </form>
</template>
