<script setup lang="ts">
import { computed } from 'vue';
import {
    Section,
    StepInput,
    Toggle,
    Typography,
    formatAmount,
    useIntl,
    useTimePeriod,
} from '@solvimon/solvimon-ui';
import type { ConfiguredMeterValue } from '@solvimon/solvimon-types';
import type { PricingGroupSeatsOptionProps } from './PricingGroupSeatsOption.types';
import TieredTable from './TieredTable.vue';
import { useSeatBasedPricing } from '@/composables/useSeatBasedPricing';
import { getNameFromPricing } from '@/utils/pricing';
import { FALLBACK_METER_NUMBER } from '@/utils/meterValues';

const props = defineProps<PricingGroupSeatsOptionProps>();
const seatsModel = defineModel<ConfiguredMeterValue | undefined>('seats');
const emit = defineEmits<{ select: [] }>();

const { $t } = useIntl();
const { formatTimePeriod } = useTimePeriod();

const seats = useSeatBasedPricing({
    pricings: [props.pricing],
    pricingItemConfigId: props.seatConfigId ?? '',
});

const period = computed(() => seats.value.billing.period ?? props.billingPeriod);

const seatsNumber = computed<number>({
    get: () => +(seatsModel.value?.number || FALLBACK_METER_NUMBER),
    set: (number) => {
        if (seatsModel.value) {
            seatsModel.value = { ...seatsModel.value, number: number.toString() };
        }
    },
});

const priceLabel = computed(() => {
    if (seats.value.pricing.amount) {
        return $t(
            {
                defaultMessage: '{amount} per seat/{period}',
                id: 'seats.price_per_seat_period',
                description: 'The price per seat and billing period label for seat-based pricing',
            },
            {
                amount: formatAmount(seats.value.pricing.amount),
                period: formatTimePeriod(period.value, {
                    short: true,
                    hideValueForExactPeriods: true,
                }),
            },
        );
    }

    return seats.value.pricing.tiered
        ? $t({
              defaultMessage: 'Tiered pricing',
              id: 'seats.tiered_pricing_label',
              description: 'The label indicating tiered pricing structure for seats',
          })
        : '';
});

// A group that takes exactly one cannot be left empty, so switching the picked option off does nothing.
const select = () => {
    if (!props.selected) {
        emit('select');
    }
};
</script>

<template>
    <Section
        no-spacing
        content-background="none"
        :content-classes="selected ? 'border-primary-500 !bg-white' : '!bg-white'"
    >
        <div class="flex items-center gap-4 px-3 py-2">
            <div class="flex grow flex-col">
                <Typography tag="span" variant="body-sm" weight="semibold">{{
                    getNameFromPricing(pricing)
                }}</Typography>
                <Typography
                    v-if="!selected && priceLabel"
                    tag="span"
                    variant="body-xs"
                    color="subtle"
                    >{{ priceLabel }}</Typography
                >
            </div>
            <Toggle :model-value="selected" size="sm" @update:model-value="select" />
        </div>

        <template v-if="selected && seatConfigId">
            <div class="flex items-center gap-4 border-t px-3 py-2">
                <div class="flex grow flex-wrap items-baseline gap-1">
                    <Typography tag="span" variant="body-sm">{{
                        $t({
                            defaultMessage: 'Included seats',
                            id: 'pricing_group_seats_option.included_seats',
                            description:
                                'The label of the seat count of the picked option in a pricing group of seat-based products',
                        })
                    }}</Typography>
                    <Typography v-if="priceLabel" tag="span" variant="body-xs" color="subtle"
                        >({{ priceLabel }})</Typography
                    >
                </div>
                <div class="w-24 shrink-0 md:w-32">
                    <StepInput
                        v-model="seatsNumber"
                        size="sm"
                        :min="defaultValue?.number ? +defaultValue.number : undefined"
                    />
                </div>
            </div>

            <TieredTable
                v-if="seats.pricing.tiered?.bands"
                class="px-3 pb-2"
                :bands="seats.pricing.tiered.bands"
                :period="period"
            />
        </template>
    </Section>
</template>
