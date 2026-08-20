<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Amount } from '@solvimon/solvimon-types';
import { helpers, requiredIf } from '@vuelidate/validators';
import {
    Expand,
    formatAmount,
    Toggle,
    Typography,
    useIntl,
    useValidation,
} from '@solvimon/solvimon-ui';
import type {
    AutoTopUpConfigEmits,
    AutoTopUpConfigFormState,
    AutoTopUpConfigProps,
    AutoTopUpRule,
} from './AutoTopUpConfig.types';
import {
    getThresholdUnit,
    isAtLeastMinimum,
    isSameAutoTopUpRule,
    normalizeAutoTopUpRule,
    toAutoTopUpRule,
    toFormState,
    toQuantity,
    isWithinMaximum,
} from './AutoTopUpConfig.lib';
import ConvertedAmountInput from '@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.vue';
import type { ConversionBase } from '@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.types';
import { toBoundQuantity } from '@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.lib';
import Section from '@/components/shared/Section/Section.vue';

const props = withDefaults(defineProps<AutoTopUpConfigProps>(), {
    showThresholdConversion: true,
});
const emit = defineEmits<AutoTopUpConfigEmits>();

const { $t, formatNumber } = useIntl();

const formContext = computed(() => ({
    denomination: props.denomination,
    chargeCurrency: props.chargeCurrency,
    creditUnitName: props.creditUnitName,
    minimumTopUp: props.topUpBounds?.minimum?.quantity,
}));

const model = ref<AutoTopUpConfigFormState>(toFormState(props.config, formContext.value));

const entryUnit = computed(() => getThresholdUnit(props.denomination, props.creditUnitName));

const entryBase = computed<ConversionBase>(() =>
    props.denomination.creditTypeId ? 'CREDITS' : 'AMOUNT',
);

const topUpUnit = computed(() =>
    entryBase.value === 'CREDITS' ? entryUnit.value : props.chargeCurrency,
);

const thresholdQuantity = computed<string>({
    get: () => model.value.threshold?.quantity ?? '',
    set: (quantity) => {
        model.value.threshold = { quantity: quantity || null, currency: entryUnit.value };
    },
});

const topUpQuantity = computed<string>({
    get: () => model.value.topUpAmount?.quantity ?? '',
    set: (quantity) => {
        model.value.topUpAmount = { quantity: quantity || null, currency: props.chargeCurrency };
    },
});

/**
 * Reseeded whenever the saved rule changes — it is fetched, so it usually arrives after this is
 * first built. Edits in progress are left alone: only a rule that differs from what is on screen is
 * worth overwriting them for.
 */
watch(
    () => [props.config, formContext.value] as const,
    ([config, context]) => {
        if (isSameAutoTopUpRule(normalizeAutoTopUpRule(config, context), currentRule())) {
            return;
        }

        model.value = toFormState(config, context);
    },
);

/**
 * Whether the wallet tops itself up. Off collapses the amounts rather than clearing them. Forced on
 * where the caller left the switch out: the rule is the point of that screen, not an option on it.
 */
const isEnabled = computed<boolean>({
    get: () => props.alwaysEnabled || model.value.enabled,
    set: (enabled) => {
        model.value.enabled = enabled;
    },
});

const rule = computed(() =>
    toAutoTopUpRule({ ...model.value, enabled: isEnabled.value }, formContext.value),
);

const currentRule = () => rule.value;

const validationState = reactive({
    threshold: computed(() => toQuantity(model.value.threshold) ?? null),
    topUpAmount: computed(() => toQuantity(model.value.topUpAmount) ?? null),
});

const formatBound = (bound?: Amount) => {
    if (!bound) {
        return '';
    }

    const quantity = toBoundQuantity(bound, entryBase.value, props.conversionRate, formatNumber);

    return quantity === undefined ? formatAmount(bound) : `${quantity} ${topUpUnit.value}`;
};

const isRequired = requiredIf(() => isEnabled.value);

const validation = useValidation(
    {
        threshold: {
            required: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'Enter the balance to top up at.',
                        description:
                            'Error shown under the auto top-up threshold when it is left empty',
                        id: 'auto_topup_config.threshold.required',
                    }),
                isRequired,
            ),
            notNegative: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'The balance to top up at cannot be negative.',
                        description:
                            'Error shown under the auto top-up threshold when it is below zero',
                        id: 'auto_topup_config.threshold.not_negative',
                    }),
                (value: number | null) => value === null || value >= 0,
            ),
        },
        topUpAmount: {
            required: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'Enter the amount to top up with.',
                        description:
                            'Error shown under the auto top-up amount when it is left empty',
                        id: 'auto_topup_config.amount.required',
                    }),
                isRequired,
            ),
            positive: helpers.withMessage(
                () =>
                    $t({
                        defaultMessage: 'Top up with more than zero.',
                        description:
                            'Error shown under the auto top-up amount when it is zero or negative',
                        id: 'auto_topup_config.amount.positive',
                    }),
                (value: number | null) => value === null || value > 0,
            ),
            atLeastMinimum: helpers.withMessage(
                () =>
                    $t(
                        {
                            defaultMessage: 'Top up with at least {minimum}.',
                            description:
                                'Error shown under the auto top-up amount when it is below what the pricing allows',
                            id: 'auto_topup_config.amount.at_least_minimum',
                        },
                        { minimum: formatBound(props.topUpBounds?.minimum) },
                    ),
                (value: number | null) => isAtLeastMinimum(value, props.topUpBounds?.minimum),
            ),
            withinMaximum: helpers.withMessage(
                () =>
                    $t(
                        {
                            defaultMessage: 'Top up with at most {maximum}.',
                            description:
                                'Error shown under the auto top-up amount when it is above what the pricing allows',
                            id: 'auto_topup_config.amount.within_maximum',
                        },
                        { maximum: formatBound(props.topUpBounds?.maximum) },
                    ),
                (value: number | null) => isWithinMaximum(value, props.topUpBounds?.maximum),
            ),
        },
    },
    validationState,
);

const hasChanges = computed(
    () =>
        !isSameAutoTopUpRule(
            currentRule(),
            normalizeAutoTopUpRule(props.config, formContext.value),
        ),
);

function validate(): AutoTopUpRule | undefined {
    validation.value.$touch();

    return validation.value.$invalid ? undefined : currentRule();
}

function submit() {
    const rule = validate();

    if (rule) {
        emit('save', rule);
    }
}

defineExpose({
    submit,
    validate,
    rule,
    hasChanges,
    isInvalid: computed(() => validation.value.$invalid),
});
</script>

<template>
    <Section
        class="sv-auto-topup-config"
        :content-background="contained ? 'gray' : 'none'"
        :no-spacing="!contained"
        :no-border="!contained"
    >
        <Toggle
            v-if="!alwaysEnabled"
            v-model="isEnabled"
            no-spacing
            label-position="before"
            class="!flex"
            :disabled="disabled"
        >
            <template #inline-label>
                <div class="flex grow flex-col">
                    <Typography tag="span" variant="body-sm">{{
                        $t({
                            defaultMessage: 'Auto top-up',
                            description: 'Title of the automatic wallet top-up settings',
                            id: 'auto_topup_config.title',
                        })
                    }}</Typography>
                    <Typography tag="span" variant="body-xs" shade="lighter">{{
                        $t({
                            defaultMessage: 'Automatically top up your balance when it runs low.',
                            description: 'Subtitle of the automatic wallet top-up settings',
                            id: 'auto_topup_config.subtitle',
                        })
                    }}</Typography>
                </div>
            </template>
        </Toggle>

        <Expand :is-open="isEnabled">
            <div
                v-if="isEnabled"
                class="grid grid-cols-1 gap-3"
                :class="{ 'mt-4': !alwaysEnabled }"
            >
                <ConvertedAmountInput
                    v-model="thresholdQuantity"
                    name="auto-top-up-threshold"
                    :unit="entryUnit"
                    :model-base="entryBase"
                    :entry-base="entryBase"
                    :currency="chargeCurrency"
                    :conversion-rate="conversionRate"
                    :show-conversion-hint="showThresholdConversion"
                    required
                    :disabled="disabled"
                    :error="validation.threshold.$errors"
                    :label="
                        $t({
                            defaultMessage: 'When your balance falls below',
                            description:
                                'Label of the balance at which an automatic top-up is charged',
                            id: 'auto_topup_config.threshold.label',
                        })
                    "
                />

                <ConvertedAmountInput
                    v-model="topUpQuantity"
                    name="auto-top-up-amount"
                    :unit="topUpUnit"
                    model-base="AMOUNT"
                    :entry-base="entryBase"
                    :currency="chargeCurrency"
                    :credit-unit-name="creditUnitName"
                    :conversion-rate="conversionRate"
                    :bounds="topUpBounds"
                    show-conversion-hint
                    required
                    :disabled="disabled"
                    :error="validation.topUpAmount.$errors"
                    :label="
                        $t({
                            defaultMessage: 'Top-up with',
                            description: 'Label of the amount every automatic top-up adds',
                            id: 'auto_topup_config.amount.label',
                        })
                    "
                />
            </div>
        </Expand>
    </Section>
</template>
