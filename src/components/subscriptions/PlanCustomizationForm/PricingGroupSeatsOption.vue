<script setup lang="ts">
import { computed } from 'vue';
import {
    Section,
    StepInput,
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

// An option that is not picked is not billed, so it shows no seats.
const seatsNumber = computed<number>({
    get: () => (props.selected ? +(seatsModel.value?.number || FALLBACK_METER_NUMBER) : 0),
    set: (number) => {
        if (seatsModel.value) {
            seatsModel.value = { ...seatsModel.value, number: number.toString() };
        }
    },
});

const select = () => {
    if (!props.selected) {
        emit('select');
    }
};
</script>

<template>
    <div
        role="radio"
        :aria-checked="selected"
        :tabindex="0"
        class="hover:cursor-pointer"
        @click="select"
        @keydown.self.enter.space.prevent="select"
    >
        <Section
            content-background="none"
            :content-classes="selected ? 'border-primary-500 !bg-white' : 'opacity-60'"
        >
            <div class="flex items-center gap-4">
                <div class="flex grow flex-col">
                    <Typography tag="span" variant="body-sm" weight="semibold">{{
                        getNameFromPricing(pricing)
                    }}</Typography>
                    <Typography
                        v-if="seats.pricing.amount"
                        tag="span"
                        variant="body-xs"
                        color="subtle"
                        >{{
                            $t(
                                {
                                    defaultMessage: '{amount} per seat/{period}',
                                    id: 'seats.price_per_seat_period',
                                    description:
                                        'The price per seat and billing period label for seat-based pricing',
                                },
                                {
                                    amount: formatAmount(seats.pricing.amount),
                                    period: formatTimePeriod(period, {
                                        short: true,
                                        hideValueForExactPeriods: true,
                                    }),
                                },
                            )
                        }}</Typography
                    >
                    <Typography
                        v-else-if="seats.pricing.tiered"
                        tag="span"
                        variant="body-xs"
                        color="subtle"
                        >{{
                            $t({
                                defaultMessage: 'Tiered pricing',
                                id: 'seats.tiered_pricing_label',
                                description:
                                    'The label indicating tiered pricing structure for seats',
                            })
                        }}</Typography
                    >
                </div>
                <!-- A disabled StepInput's Input turns its hidden native value visible next to the number
                     it draws itself (solvimon-ui), so it is kept transparent here. -->
                <div v-if="seatConfigId" class="w-24 shrink-0 md:w-32 [&_input]:!text-transparent">
                    <StepInput
                        v-model="seatsNumber"
                        size="sm"
                        :disabled="!selected"
                        :min="selected && defaultValue?.number ? +defaultValue.number : 0"
                    />
                </div>
            </div>

            <TieredTable
                v-if="selected && seats.pricing.tiered?.bands"
                class="mt-2"
                :bands="seats.pricing.tiered.bands"
                :period="period"
            />
        </Section>
    </div>
</template>
