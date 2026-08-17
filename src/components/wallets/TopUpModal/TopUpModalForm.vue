<script setup lang="ts">
import type { Amount, WalletBalanceValue } from '@solvimon/solvimon-types';
import { computed, ref, watch } from 'vue';
import {
    Expand,
    FlexiblePricingInput,
    formatAmount,
    formatWalletBalanceValue,
    InvoicePreview,
    RadioGroupExtended,
    Typography,
    useIntl,
    Section,
    Divider,
} from '@solvimon/solvimon-ui';
import {
    type TopUpModalFormEmits,
    type TopUpModalFormProps,
    type TopUpModalFormState,
} from './TopUpModalForm.types';
import { useTopUpInvoicePreview } from './useTopUpInvoicePreview';
import { getTopUpValue, type TopUpPricingItem } from './TopUpModal.lib';
import Skeleton from '@/components/shared/Skeleton.vue';
import PaymentMethodSelector from '@/components/payments/PaymentMethodSelector/PaymentMethodSelector.vue';
import { createInvoicesService } from '@/services/invoices';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const props = defineProps<TopUpModalFormProps>();
const emit = defineEmits<TopUpModalFormEmits>();

const { $t, formatNumber } = useIntl();

const model = ref<TopUpModalFormState>({
    pricing_plan_schedule_id: '',
    pricing_items: [],
    start_at: '',
    finalize_immediately: false,
    payment_method_id: undefined,
    preview: true,
});

/** Only the ways this wallet can actually be charged are offered. */
const chargeableItems = computed(() =>
    (props.topUpPricingItems ?? []).filter((item) => item.flexiblePricing || item.fixedPricing),
);

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

// Credits or money, whichever the wallet holds — the same formatting the modal's subtitle uses.
const formatValue = (value: WalletBalanceValue) =>
    formatWalletBalanceValue($t, formatNumber, value);

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

const { invoicePreview } = useTopUpInvoicePreview({ pricingPlanScheduleId, pricingItems });

const { chargeOnDemandPricingItems } = createInvoicesService();
const logger = useLogger();

const isCharging = ref(false);

/** There is nothing to charge until a top-up is chosen and, if flexible, an amount entered. */
const canSubmit = computed(() => !!model.value.pricing_plan_schedule_id && !!pricingItems.value);

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
    if (!canSubmit.value || isCharging.value) {
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

        emit('success', invoice);
    } catch (error) {
        logger.error('TOP_UP_FAILED', 'Failed to charge the wallet top-up', {}, error);
        emit('failure', error);
    } finally {
        isCharging.value = false;
    }
}

defineExpose({ submit, isCharging, canSubmit, chargedValue });

/** Which stored payment method pays for the top-up — kept on the payload it is submitted with. */
const selectedPaymentMethodId = computed<string | undefined>({
    get: () => model.value.payment_method_id ?? undefined,
    set: (paymentMethodId) => {
        model.value.payment_method_id = paymentMethodId;
    },
});

const toTime = (createdAt?: string) => {
    const parsed = Date.parse(createdAt ?? '');

    return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Newest first, so a method the customer just added leads the list rather than being buried at the
 * bottom of it.
 */
const sortedPaymentMethods = computed(() =>
    [...(props.paymentMethods ?? [])].sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
);

/**
 * Start on the customer's default payment method, falling back to the newest one they have — but
 * prefer one they have just added, since adding it was a deliberate act. Otherwise it leaves a choice
 * they have already made alone, so the list arriving late cannot overrule them.
 */
watch(
    () => props.paymentMethods,
    (paymentMethods, previousPaymentMethods) => {
        const addedPaymentMethod = paymentMethods?.find(
            ({ id }) => !previousPaymentMethods?.some((previous) => previous.id === id),
        );

        // Only a list that already had methods and then grew means the customer added one. Arriving
        // from nothing is the list loading, where the default should still win.
        if (addedPaymentMethod && previousPaymentMethods?.length) {
            selectedPaymentMethodId.value = addedPaymentMethod.id;
            return;
        }

        const chosenStillExists = paymentMethods?.some(
            ({ id }) => id === model.value.payment_method_id,
        );

        if (chosenStillExists) {
            return;
        }

        selectedPaymentMethodId.value = (
            paymentMethods?.find(({ is_default }) => is_default) ?? sortedPaymentMethods.value[0]
        )?.id;
    },
    { immediate: true },
);
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
                            <!--
                                The bounds ride inside the panel with the input they describe, so
                                choosing this option grows the two as one movement rather than
                                snapping the text in and then easing the input open beneath it.
                            -->
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
                                    <FlexiblePricingInput
                                        v-model="flexibleAmount"
                                        :config="flexiblePricing.config"
                                        :currency="flexiblePricing.currency"
                                        :credits-configuration="
                                            flexiblePricing.creditsConfiguration
                                        "
                                        required
                                        :disabled="isCharging"
                                        :show-range-hint="false"
                                    />
                                </div>
                            </Expand>
                        </div>
                    </template>
                </RadioGroupExtended>

                <!--
                    invoice preview

                    The section is what waits on the request, not the preview inside it: `Skeleton`
                    hands over to its slot as soon as that slot renders anything at all, so an empty
                    section there left the placeholder unreachable and an empty bordered box on
                    screen, growing to the preview's height once it landed.

                    The placeholder is one plain block, fixed at the height a preview usually comes
                    back at. The section variant would add a title bar this has nothing to put in,
                    and any other height puts the jump back.
                -->
                <Skeleton
                    v-if="pricingItems"
                    class="h-[152px]"
                    data-testid="top-up-invoice-preview-skeleton"
                >
                    <Section v-if="invoicePreview" content-background="none">
                        <InvoicePreview :invoice="invoicePreview" is-customer-facing />
                    </Section>
                </Skeleton>
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
