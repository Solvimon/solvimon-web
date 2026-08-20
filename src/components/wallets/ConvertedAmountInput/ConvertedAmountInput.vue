<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Amount } from '@solvimon/solvimon-types';
import { formatAmount, Input, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { ConvertedAmountInputProps } from './ConvertedAmountInput.types';
import {
    toBoundQuantity,
    toConvertedQuantity,
    toFieldQuantity,
    toMoneyQuantity,
    toNumber,
    toOtherBase,
} from './ConvertedAmountInput.lib';

const props = defineProps<ConvertedAmountInputProps>();

const model = defineModel<string>({ default: '' });

const { $t, formatNumber } = useIntl();

const entryBase = computed(() => props.entryBase ?? props.modelBase);

const isConverted = computed(
    () => entryBase.value !== props.modelBase && toNumber(props.conversionRate) !== undefined,
);

const entered = ref('');

watch(
    () => [model.value, entryBase.value, props.modelBase, props.conversionRate] as const,
    ([quantity]) => {
        if (!isConverted.value) {
            entered.value = quantity ?? '';
            return;
        }

        if (quantity === toEnteredAsModel(entered.value)) {
            return;
        }

        const converted = toOtherBase(
            quantity,
            props.modelBase,
            entryBase.value,
            props.conversionRate,
        );

        entered.value = converted === undefined ? '' : toFieldQuantity(converted, entryBase.value);
    },
    { immediate: true },
);

type InputQuantity = string | number | string[] | null | undefined;

/** Whatever the input reported, as the text this field holds. Empty for anything it cannot mean. */
function toEnteredText(quantity: InputQuantity): string {
    if (typeof quantity === 'string') {
        return quantity;
    }

    return typeof quantity === 'number' ? String(quantity) : '';
}

function toEnteredAsModel(quantity: string): string {
    const converted = toOtherBase(quantity, entryBase.value, props.modelBase, props.conversionRate);

    return converted === undefined ? '' : toFieldQuantity(converted, props.modelBase);
}

const enteredQuantity = computed<string, InputQuantity>({
    get: () => entered.value,
    set: (quantity) => {
        entered.value = toEnteredText(quantity);
        model.value = isConverted.value ? toEnteredAsModel(entered.value) : entered.value;
    },
});

const convertedQuantity = computed(() =>
    toConvertedQuantity(entered.value, entryBase.value, props.conversionRate),
);

const creditUnitName = computed(() => {
    if (props.creditUnitName) {
        return props.creditUnitName;
    }

    return entryBase.value === 'CREDITS'
        ? props.unit
        : $t({
              defaultMessage: 'credits',
              description:
                  'Generic name for a wallet credit, where its credit type does not name one',
              id: 'converted_amount_input.credits',
          });
});

const formatMoney = (quantity: number, currency: Amount['currency']) =>
    formatAmount({ quantity: toMoneyQuantity(quantity), currency });

const formatCredits = (quantity: number) => `${formatNumber(quantity)} ${creditUnitName.value}`;

const helperText = computed(() => {
    const converted = convertedQuantity.value;

    if (!props.showConversionHint || converted === undefined) {
        return undefined;
    }

    if (entryBase.value === 'CREDITS') {
        return props.currency
            ? $t(
                  {
                      defaultMessage: 'Will cost {amount} excluding taxes',
                      description:
                          'Helper text under a credits field, naming what those credits cost in money',
                      id: 'converted_amount_input.cost',
                  },
                  { amount: formatMoney(converted, props.currency) },
              )
            : undefined;
    }

    return $t(
        {
            defaultMessage: 'Buys about {credits}',
            description:
                'Helper text under a money field, naming the credits that amount converts into',
            id: 'converted_amount_input.buys',
        },
        { credits: formatCredits(converted) },
    );
});

const toBound = (bound?: Amount) =>
    toBoundQuantity(bound, entryBase.value, props.conversionRate, formatNumber);

const boundsUnit = computed(() =>
    entryBase.value === 'CREDITS'
        ? creditUnitName.value
        : (props.bounds?.minimum?.currency ?? props.bounds?.maximum?.currency ?? props.unit),
);

const boundsText = computed(() => {
    const minimum = toBound(props.bounds?.minimum);
    const maximum = toBound(props.bounds?.maximum);
    const unit = boundsUnit.value;

    if (minimum && maximum) {
        return $t(
            {
                defaultMessage: 'Between {minimum} and {maximum} {unit}',
                description: 'Range of what a flexible top-up may be charged for, beside its label',
                id: 'converted_amount_input.bounds.range',
            },
            { minimum, maximum, unit },
        );
    }

    if (minimum) {
        return $t(
            {
                defaultMessage: 'At least {minimum} {unit}',
                description:
                    'Smallest amount a flexible top-up may be charged for, beside its label',
                id: 'converted_amount_input.bounds.minimum',
            },
            { minimum, unit },
        );
    }

    if (maximum) {
        return $t(
            {
                defaultMessage: 'Up to {maximum} {unit}',
                description:
                    'Largest amount a flexible top-up may be charged for, beside its label',
                id: 'converted_amount_input.bounds.maximum',
            },
            { maximum, unit },
        );
    }

    return undefined;
});
</script>

<template>
    <Input
        v-model="enteredQuantity"
        class="sv-converted-amount-input"
        type="number"
        as-text-type
        :name="name"
        :label="label"
        :required="required"
        :disabled="disabled"
        :error="error"
    >
        <template v-if="boundsText" #label-suffix>
            <Typography
                tag="span"
                variant="body-xs"
                shade="lighter"
                no-spacing
                :data-testid="`${name}-bounds`"
                >{{ boundsText }}</Typography
            >
        </template>

        <template #suffix>
            <span :data-testid="`${name}-unit`">{{ unit }}</span>
        </template>

        <template v-if="helperText" #helper>
            <Typography
                tag="span"
                variant="body-xs"
                shade="lighter"
                no-spacing
                :data-testid="`${name}-conversion`"
                >{{ helperText }}</Typography
            >
        </template>
    </Input>
</template>
