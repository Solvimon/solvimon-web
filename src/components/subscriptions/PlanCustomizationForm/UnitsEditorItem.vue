<script setup lang="ts">
import { useIntl, formatAmount, Input, StepInput, Typography } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import { computed, ref } from 'vue';
import type { UnitsEditorItemProps } from './UnitsEditorItem.types';
import { useSeatBasedPricing } from '@/composables/useSeatBasedPricing';
import { FALLBACK_METER_NUMBER } from '@/utils/meterValues';

const props = defineProps<UnitsEditorItemProps>();
const model = defineModel<ConfiguredMeterValue>('modelValue', { required: true });

const { $t } = useIntl();

const setUnits = (input: unknown) => {
    // An emptied or unreadable number field leaves the quantity as it was.
    const number = Number(input);
    if (input === '' || input === null || !Number.isFinite(number)) return;
    const max = props.maxValue?.number ? +props.maxValue.number : undefined;
    // Remounted so the field shows the maximum it was lowered to, not what was typed.
    if (max !== undefined && number > max) clampCount.value++;
    const value = max !== undefined ? Math.min(number, max) : number;
    model.value = { ...model.value, number: value.toString() };
};

const unitsNumber = computed<number>({
    get: () => +(model.value.number || FALLBACK_METER_NUMBER),
    set: setUnits,
});

const clampCount = ref(0);

/**
 * The stepper reads whole numbers only, so a bounded config with a fraction anywhere gets a number
 * field. Decided once, so the field does not swap while the customer types.
 */
const isFractional =
    !!props.maxValue &&
    [model.value.number, props.defaultValue?.number, props.maxValue.number].some(
        (number) => number !== undefined && !Number.isInteger(Number(number)),
    );

// A one-off flat item is always FLAT pricing (server-validated), so there is no tiered branch.
const units = useSeatBasedPricing({
    pricings: props.pricings,
    pricingItemConfigId: model.value.pricing_item_config_id,
});

const unitsLabel = computed(
    () =>
        units.value.product.name ||
        $t({
            defaultMessage: 'Units',
            id: 'units.label',
            description: 'The label for the one-off flat item units input field',
        }),
);

const numberFieldAttrs = computed(() => ({
    step: 'any',
    inputmode: 'decimal',
    min: props.defaultValue?.number,
    max: props.maxValue?.number,
}));
</script>

<template>
    <div class="flex flex-row-reverse gap-4 md:flex-row">
        <div class="w-24 shrink-0 justify-start md:w-32">
            <Input
                v-if="isFractional"
                :key="`input-${clampCount}`"
                v-bind="numberFieldAttrs"
                :model-value="unitsNumber"
                type="number"
                size="sm"
                :label="unitsLabel"
                label-screen-reader-only
                :disabled="disabled"
                @update:model-value="setUnits"
            />
            <StepInput
                v-else
                :key="clampCount"
                v-model="unitsNumber"
                size="sm"
                :min="defaultValue?.number ? +defaultValue.number : undefined"
                :max="maxValue?.number ? +maxValue.number : undefined"
                :disabled="disabled"
            />
        </div>
        <div class="flex grow flex-col">
            <Typography tag="span" variant="body-sm" weight="semibold">{{ unitsLabel }}</Typography>
            <Typography v-if="units.pricing.amount" tag="span" variant="body-xs" color="subtle">{{
                $t(
                    {
                        defaultMessage: '{amount} per unit, one-time',
                        id: 'units.price_per_unit_one_time',
                        description:
                            'The price per unit label for a one-off flat item, which is charged once rather than every period',
                    },
                    { amount: formatAmount(units.pricing.amount) },
                )
            }}</Typography>
        </div>
    </div>
</template>
