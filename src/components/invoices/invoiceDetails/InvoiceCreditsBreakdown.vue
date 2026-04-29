<script setup lang="ts">
import type { CreditType, Invoice, InvoiceCreditQuantity, InvoicePeriod } from '@solvimon/solvimon-types';
import {
    DividerText,
    Icon,
    InvoiceTable,
    InvoiceTableData,
    InvoiceTableHeader,
    Typography,
    useIntl,
    useToggleList,
} from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import { buildInvoiceCreditsBreakdown } from './InvoiceCreditsBreakdown.utils';

const props = defineProps<{
    invoice: Invoice;
}>();

const { formatDate, $t, formatMessage, formatNumber } = useIntl();
const { getIsOpen, toggle } = useToggleList<string>();

const creditTypesById = computed(() =>
    Object.fromEntries(
        (props.invoice.credit_types ?? []).map((creditType: CreditType) => [
            creditType.id,
            creditType,
        ]),
    ),
);

const getPeriodTitle = (period: InvoicePeriod) =>
    formatMessage(
        {
            defaultMessage: 'Service period - {startAt} - {endAt}',
            id: 'kFCxC4',
            description: 'Heading shown above wallet balance details for an invoice period',
        },
        {
            startAt: formatDate({
                date: period.start_at,
                format: 'date',
                offsetType: 'offsetted',
                timezone: props.invoice.customer.timezone,
            }),
            endAt: formatDate({
                date: period.end_at,
                format: 'date',
                offsetType: 'offsetted',
                timezone: props.invoice.customer.timezone,
            }),
        },
    );

const getCreditTypeLabel = (credits?: InvoiceCreditQuantity) => {
    if (!credits?.credit_type_id) {
        return formatMessage({
            defaultMessage: 'Credits',
            id: 'K2fM1n',
            description: 'Fallback label for wallet balance credit types when no name is available',
        });
    }

    return creditTypesById.value[credits.credit_type_id]?.name ?? credits.credit_type_id;
};

const formatQuantity = (quantity?: string) =>
    quantity
        ? formatNumber(Number(quantity))
        : formatMessage({
              defaultMessage: '-',
              id: 'dHb0fN',
              description: 'Placeholder shown when a wallet balance quantity is missing',
          });

const periodsWithCredits = computed(() =>
    buildInvoiceCreditsBreakdown({
        invoice: props.invoice,
        getPeriodTitle,
        getCreditTypeLabel,
        formatQuantity,
    }),
);
</script>

<template>
    <section v-if="periodsWithCredits.length > 0" class="mt-8">
        <div class="flex flex-col gap-6">
            <section v-for="period in periodsWithCredits" :key="period.id">
                <DividerText class="mt-4">
                    <Typography tag="h3" variant="caps-heading">
                        {{ period.title }}
                    </Typography>
                </DividerText>

                <InvoiceTable class="mt-3">
                    <tr>
                        <InvoiceTableHeader left class="text-gray-600">
                            {{
                                $t({
                                    defaultMessage: 'Wallet balance',
                                    id: 'j2d7b2',
                                    description:
                                        'Section header for invoice wallet balance details',
                                })
                            }}
                        </InvoiceTableHeader>
                    </tr>

                    <template v-for="row in period.rows" :key="row.id">
                        <tr
                            class="cursor-pointer border-t"
                            tabindex="0"
                            @click="toggle(row.id)"
                            @keyup.enter="toggle(row.id)"
                            @keyup.space="toggle(row.id)"
                        >
                            <InvoiceTableData class="p-0">
                                <Icon
                                    icon="keyboard_arrow_down"
                                    size="md"
                                    class="absolute -translate-x-7 text-slate-400"
                                    :class="{ '-rotate-90': !getIsOpen(row.id) }"
                                />
                                {{ row.label }}
                                <span
                                    class="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-100 text-2xs font-bold text-blue-600"
                                >
                                    {{ row.rows.length }}
                                </span>
                            </InvoiceTableData>
                        </tr>

                        <tr v-if="getIsOpen(row.id)">
                            <td class="p-0">
                                <div class="-mx-9 bg-gray-50 px-9 py-3 text-xs">
                                    <InvoiceTable>
                                        <tr>
                                            <InvoiceTableHeader left class="w-2/5">
                                                {{
                                                    $t({
                                                        defaultMessage: 'Credit breakdown',
                                                        id: '65I4e4',
                                                        description:
                                                            'Column header for wallet balance credit type details',
                                                    })
                                                }}
                                            </InvoiceTableHeader>
                                            <InvoiceTableHeader right class="w-1/5">
                                                {{
                                                    $t({
                                                        defaultMessage: 'Balance',
                                                        id: '4UjRe6',
                                                        description:
                                                            'Column header for the available wallet balance amount',
                                                    })
                                                }}
                                            </InvoiceTableHeader>
                                            <InvoiceTableHeader right class="w-1/5">
                                                {{
                                                    $t({
                                                        defaultMessage: 'Used',
                                                        id: 'rUy4Lk',
                                                        description:
                                                            'Column header for the used wallet credit amount',
                                                    })
                                                }}
                                            </InvoiceTableHeader>
                                            <InvoiceTableHeader right class="w-1/5">
                                                {{
                                                    $t({
                                                        defaultMessage: 'Remaining',
                                                        id: 'C8F4/r',
                                                        description:
                                                            'Column header for the remaining wallet credit amount',
                                                    })
                                                }}
                                            </InvoiceTableHeader>
                                        </tr>

                                        <tr
                                            v-for="breakdownRow in row.rows"
                                            :key="breakdownRow.id"
                                            class="border-t"
                                        >
                                            <InvoiceTableData>{{
                                                breakdownRow.label
                                            }}</InvoiceTableData>
                                            <InvoiceTableData number>{{
                                                breakdownRow.available
                                            }}</InvoiceTableData>
                                            <InvoiceTableData number>{{
                                                breakdownRow.used
                                            }}</InvoiceTableData>
                                            <InvoiceTableData number>{{
                                                breakdownRow.left
                                            }}</InvoiceTableData>
                                        </tr>
                                    </InvoiceTable>
                                </div>
                            </td>
                        </tr>
                    </template>
                </InvoiceTable>
            </section>
        </div>
    </section>
</template>
