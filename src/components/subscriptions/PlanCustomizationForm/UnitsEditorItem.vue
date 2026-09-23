<script setup lang="ts">
import { useIntl, formatAmount, StepInput, Typography } from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import { computed } from 'vue';
import type { UnitsEditorItemProps } from './UnitsEditorItem.types';
import { useSeatBasedPricing } from '@/composables/useSeatBasedPricing';
import { FALLBACK_UNITS_NUMBER } from '@/utils/unitsValues';

const props = defineProps<UnitsEditorItemProps>();
const model = defineModel<ConfiguredMeterValue>('modelValue', { required: true });

const { $t } = useIntl();

const unitsNumber = computed<number>({
    get: () => +(model.value.number || FALLBACK_UNITS_NUMBER),
    set(number: number) {
        model.value = {
            ...model.value,
            number: number !== undefined ? number.toString() : undefined,
        };
    },
});

// A one-off flat item is always FLAT pricing (server-validated), so there is no tiered branch.
const units = useSeatBasedPricing({
    pricings: props.pricings,
    pricingItemConfigId: model.value.pricing_item_config_id,
});
</script>

<template>
    <div class="flex flex-row-reverse gap-4 md:flex-row">
        <div class="w-24 shrink-0 justify-start md:w-32">
            <StepInput
                v-model="unitsNumber"
                size="sm"
                :min="defaultValue?.number ? +defaultValue.number : undefined"
            />
        </div>
        <div class="flex grow flex-col">
            <Typography tag="span" variant="body-sm" weight="semibold">{{
                units.product.name ||
                $t({
                    defaultMessage: 'Units',
                    id: 'units.label',
                    description: 'The label for the one-off flat item units input field',
                })
            }}</Typography>
            <Typography v-if="units.pricing.amount" tag="span" variant="body-xs" color="subtle">{{
                $t(
                    {
                        defaultMessage: '{amount} per unit',
                        id: 'units.price_per_unit',
                        description: 'The price per unit label for one-off flat pricing',
                    },
                    { amount: formatAmount(units.pricing.amount) },
                )
            }}</Typography>
        </div>
    </div>
</template>
