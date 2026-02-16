<script setup lang="ts">
import {
    useIntl,
    formatAmount,
    StepInput,
    Typography,
    Icon,
    useTimePeriod,
    Expand,
} from '@solvimon/ui';
import type { ConfiguredMeterValue } from '@solvimon/types';
import { computed, ref } from 'vue';
import type { SeatsEditorItemProps } from './SeatsEditorItem.types';
import TieredTable from './TieredTable.vue';
import { useSeatBasedPricing } from '@/composables/useSeatBasedPricing';

const props = defineProps<SeatsEditorItemProps>();
const model = defineModel<ConfiguredMeterValue>('modelValue', { required: true });

const { $t } = useIntl();
const { formatTimePeriod } = useTimePeriod();

const isExpanded = ref(false);

const seatsNumber = computed<number>({
    get: () => (model.value.number ? +model.value.number : 1),
    set(number: number) {
        model.value = {
            ...model.value,
            number: number !== undefined ? number.toString() : undefined,
        };
    },
});

const seats = useSeatBasedPricing({
    pricings: props.pricings,
    pricingItemConfigId: model.value.pricing_item_config_id,
});

const isCollapsible = computed(() => !!seats.value.pricing?.tiered?.bands);
</script>

<template>
    <div>
        <div class="flex flex-row-reverse md:flex-row gap-4">
            <div class="w-24 md:w-32 shrink-0 justify-start">
                <StepInput
                    v-model="seatsNumber"
                    size="sm"
                    :min="defaultValue?.number ? +defaultValue.number : undefined"
                />
            </div>
            <div
                class="flex flex-col grow"
                :class="{ 'hover:cursor-pointer': isCollapsible }"
                :tabindex="isCollapsible ? 0 : undefined"
                @click="isCollapsible ? (isExpanded = !isExpanded) : undefined"
            >
                <Typography tag="span" variant="body-sm" weight="semibold">{{
                    seats.product.name ||
                    $t({
                        defaultMessage: 'Seats',
                        id: 'seats.label',
                        description: 'The label for the seats input field',
                    })
                }}</Typography>
                <Typography
                    v-if="seats.pricing.amount"
                    tag="span"
                    variant="body-xs"
                    shade="lighter"
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
                                period: seats.billing.period
                                    ? formatTimePeriod(seats.billing.period, {
                                          short: true,
                                          hideValueForExactPeriods: true,
                                      })
                                    : '',
                            },
                        )
                    }}</Typography
                >
                <template v-else-if="seats.pricing.tiered">
                    <!-- heading -->
                    <Typography tag="span" variant="body-xs" shade="lighter">
                        {{
                            $t({
                                defaultMessage: 'Tiered pricing',
                                id: 'seats.tiered_pricing_label',
                                description:
                                    'The label indicating tiered pricing structure for seats',
                            })
                        }}
                        <Icon
                            icon="keyboard_arrow_down"
                            size="xs"
                            class="absolute transition ease-in-out text-gray-400"
                            :class="{ 'rotate-0': !isExpanded, 'rotate-180': isExpanded }"
                        />
                    </Typography>
                </template>
            </div>
        </div>

        <!-- content-->
        <div v-if="seats.pricing?.tiered?.bands">
            <Expand>
                <div v-if="isExpanded">
                    <TieredTable
                        :bands="seats.pricing.tiered.bands"
                        :period="seats.billing.period"
                    />
                </div>
            </Expand>
        </div>
    </div>
</template>
