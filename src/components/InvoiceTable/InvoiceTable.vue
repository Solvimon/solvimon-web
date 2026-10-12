<script setup lang="ts">
import {
    Amount,
    Button,
    Chip,
    ErrorNotification,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableHeadRow,
    TableRow,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { InvoiceTableEmits, InvoiceTableProps } from './InvoiceTable.types';
import {
    getInvoiceTimezone,
    isCreditInvoice,
    isInvoicePaid,
    isInvoicePayable,
} from '@/utils/invoiceState';

const props = defineProps<InvoiceTableProps>();
defineEmits<InvoiceTableEmits>();

const { formatDate, $t } = useIntl();

const showPayButton = computed(() => props.configuration.showPayButton);
const showViewButton = computed(() => props.configuration.showViewButton);
const showLoadMoreButton = computed(() => props.hasMoreItems);
</script>

<template>
    <div class="sv-table sv-invoices-list__table grid-cols-1 gap-4">
        <Table>
            <TableHead>
                <TableHeadRow class="sv-table__head">
                    <TableHeadCell class="sv-table__cell sv-invoices-list__cell--invoice">
                        {{
                            $t({
                                defaultMessage: 'Invoice',
                                description:
                                    'The title of the invoice number header column of the invoice table',
                                id: 'invoice_table.header.invoice_number',
                            })
                        }}
                    </TableHeadCell>
                    <TableHeadCell
                        class="sv-table__cell sv-invoices-list__cell--date hidden md:table-cell"
                    >
                        {{
                            $t({
                                defaultMessage: 'Date',
                                description:
                                    'The title of the invoice date header column of the invoice table',
                                id: 'invoice_table.header.date',
                            })
                        }}
                    </TableHeadCell>
                    <TableHeadCell class="sv-table__cell sv-invoices-list__cell--amount">
                        {{
                            $t({
                                defaultMessage: 'Amount',
                                description:
                                    'The title of the invoice amount header column of the invoice table',
                                id: 'invoice_table.header.amount',
                            })
                        }}
                    </TableHeadCell>
                    <TableHeadCell class="sv-table__cell sv-invoices-list__cell--status text-right">
                        {{
                            $t({
                                defaultMessage: 'Status',
                                description:
                                    'The title of the invoice status header column of the invoice table',
                                id: 'invoice_table.header.status',
                            })
                        }}
                    </TableHeadCell>
                </TableHeadRow>
            </TableHead>
            <TableBody>
                <TableRow
                    v-for="invoice in invoices"
                    :key="invoice.id"
                    class="sv-table__row sv-invoices-list__row"
                >
                    <template v-if="showViewButton" #link>
                        <button
                            type="button"
                            class="sv-invoices-list__row-action absolute inset-0 h-full w-full"
                            :aria-label="
                                $t(
                                    {
                                        defaultMessage: 'View invoice {invoiceNumber}',
                                        description:
                                            'Accessible name of the button covering an invoice row, which opens that invoice',
                                        id: 'invoice_table.row.view_invoice_aria_label',
                                    },
                                    { invoiceNumber: invoice.invoice_number || invoice.id },
                                )
                            "
                            @click="$emit('view-invoice', { invoiceId: invoice.id })"
                        />
                    </template>
                    <TableCell
                        class="sv-table__cell sv-invoices-list__cell sv-invoices-list__cell--invoice h-14"
                    >
                        <div class="flex flex-col">
                            <Typography tag="span" variant="body-sm" class="md:hidden">
                                {{
                                    formatDate({
                                        date: invoice.invoice_date,
                                        format: 'date',
                                        offsetType: 'offsetted',
                                        timezone: getInvoiceTimezone(invoice),
                                    })
                                }}
                            </Typography>
                            <Typography tag="span" variant="body-xs" color="subtle">
                                {{ invoice.invoice_number }}</Typography
                            >
                        </div>
                    </TableCell>
                    <TableCell
                        class="sv-table__cell sv-invoices-list__cell sv-invoices-list__cell--date hidden h-14 md:table-cell"
                    >
                        {{
                            formatDate({
                                date: invoice.invoice_date,
                                format: 'date',
                                offsetType: 'offsetted',
                                timezone: getInvoiceTimezone(invoice),
                            })
                        }}
                    </TableCell>
                    <TableCell
                        class="sv-table__cell sv-invoices-list__cell sv-invoices-list__cell--amount h-14"
                        ><Typography tag="span" weight="semibold">
                            <Amount :value="invoice.invoice_amount_including_tax" /> </Typography
                    ></TableCell>
                    <TableCell
                        class="sv-table__cell sv-invoices-list__cell sv-invoices-list__cell--status h-14 text-right"
                    >
                        <Chip v-if="isInvoicePaid(invoice)" intent="success">
                            {{
                                $t({
                                    defaultMessage: 'Paid',
                                    description: 'The label of the chip for paid invoices',
                                    id: 'invoice_table.chip.paid',
                                })
                            }}
                        </Chip>
                        <Chip v-else-if="isCreditInvoice(invoice)" intent="neutral">
                            {{
                                $t({
                                    defaultMessage: 'Credit note',
                                    description: 'The label of the chip for credit notes',
                                    id: 'invoice_table.chip.credit_note',
                                })
                            }}
                        </Chip>
                        <Chip v-else-if="invoice.status === 'VOID'" intent="neutral">
                            {{
                                $t({
                                    defaultMessage: 'Void',
                                    description: 'The label of the chip for voided invoices',
                                    id: 'invoice_table.chip.void',
                                })
                            }}
                        </Chip>
                        <Button
                            v-else-if="showPayButton && isInvoicePayable(invoice)"
                            intent="secondary"
                            size="xs"
                            class="sv-action sv-action--secondary sv-invoices-list__pay"
                            type="button"
                            @click.stop="$emit('pay-invoice', { invoiceId: invoice.id })"
                            >{{
                                $t({
                                    defaultMessage: 'Pay',
                                    description: 'The label for the pay invoice button',
                                    id: 'customer.invoice_table.pay_invoice_button.label',
                                })
                            }}</Button
                        >
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
        <ErrorNotification
            v-if="error"
            class="sv-invoices-list__error sv-error"
            :title="
                $t({
                    defaultMessage: 'We could not load your invoices. Please try again.',
                    description:
                        'Error shown when the invoices, or the next batch of them, fail to load',
                    id: 'invoice_table.load_error',
                })
            "
        />
        <div class="sv-invoices-list__load-more mt-2 flex items-center justify-center">
            <Button
                v-if="showLoadMoreButton"
                intent="secondary"
                size="sm"
                class="sv-action sv-action--secondary sv-action--full-width w-full"
                :loading="isLoading"
                @click="$emit('load-more')"
            >
                {{
                    $t({
                        defaultMessage: 'Load more',
                        description: 'The label for the load more button',
                        id: 'invoice_table.button.load_more',
                    })
                }}
            </Button>
        </div>
    </div>
</template>
