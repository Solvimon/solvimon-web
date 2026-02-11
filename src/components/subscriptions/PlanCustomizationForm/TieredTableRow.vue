<script setup lang="ts">
import { computed } from 'vue';
import { formatAmount, Typography, useIntl, useTimePeriod } from '@solvimon/ui';
import type { TieredTableRowProps } from './TieredTableRow.types';

const props = defineProps<TieredTableRowProps>();

const { $t } = useIntl();
const { formatTimePeriod } = useTimePeriod();

const tierLowerBoundNumber = computed<string | undefined>(() => {
    if (props.isFirst) {
        return '0';
    }

    if (props.previousBand?.tier_top_bound && 'number' in props.previousBand.tier_top_bound) {
        return props.previousBand.tier_top_bound.number;
    }

    return undefined;
});

const tierTopBoundNumber = computed<string | undefined>(() => {
    if (!props.band.tier_top_bound || !('number' in props.band.tier_top_bound)) {
        return undefined;
    }

    return props.band.tier_top_bound.number;
});
</script>

<template>
    <div class="grid grid-cols-2 gap-2">
        <!-- count -->
        <Typography variant="body-xs" shade="lighter" tag="div">
            <template v-if="tierTopBoundNumber">
                {{
                    $t(
                        {
                            defaultMessage: '{lower_bound} - {upper_bound} seats',
                            id: 'seats.tiered_range_label',
                            description:
                                'The label showing the seat count range for a tiered pricing tier',
                        },
                        {
                            lower_bound: tierLowerBoundNumber ?? '0',
                            upper_bound: tierTopBoundNumber,
                        },
                    )
                }}
            </template>
            <template v-else>
                {{
                    $t(
                        {
                            defaultMessage: '> {lower_bound} seats',
                            id: 'seats.tiered_unbounded_range_label',
                            description:
                                'The label showing the unbounded seat count range (greater than) for a tiered pricing tier',
                        },
                        {
                            lower_bound: tierLowerBoundNumber ?? '0',
                        },
                    )
                }}
            </template>
        </Typography>

        <!-- price -->
        <Typography variant="body-xs" shade="lighter" tag="div" class="text-right">
            {{
                band.amount &&
                $t(
                    {
                        defaultMessage: '{amount} per seat/{period}',
                        id: 'seats.tiered_price_per_seat_period',
                        description:
                            'The price per seat and billing period label for a tiered pricing tier',
                    },
                    {
                        amount: formatAmount(band.amount),
                        period: period
                            ? formatTimePeriod(period, {
                                  short: true,
                                  hideValueForExactPeriods: true,
                              })
                            : '',
                    },
                )
            }}
        </Typography>
    </div>
</template>
