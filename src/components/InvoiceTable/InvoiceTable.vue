<script setup lang="ts">
import {
    Amount,
    Button,
    Chip,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeadCell,
    TableHeadRow,
    TableRow,
    useIntl,
} from '@solvimon/ui';
import type { Invoice } from '@solvimon/types';
import type { InvoiceTableProps, InvoiceTableEmits } from './InvoiceTable.types';

defineProps<InvoiceTableProps>();
const emit = defineEmits<InvoiceTableEmits>();

const { formatDate, $t } = useIntl();

const handleViewInvoice = (invoiceId: Invoice['id']): void => {
    emit('view-invoice', invoiceId);
};

const handlePayInvoice = (invoiceId: Invoice['id']): void => {
    emit('pay-invoice', invoiceId);
};
</script>

<template>
    <Table striped no-border rounded hoverable stripe-class="group-odd:bg-gray-50/50">
        <TableHead>
            <TableHeadRow>
                <TableHeadCell>
                    {{
                        $t({
                            defaultMessage: 'Invoice',
                            description:
                                'The title of the invoice number header column of the invoice table',
                            id: 'invoice_table.header.invoice_number',
                        })
                    }}
                </TableHeadCell>
                <TableHeadCell class="hidden md:table-cell">
                    {{
                        $t({
                            defaultMessage: 'Date',
                            description:
                                'The title of the invoice date header column of the invoice table',
                            id: 'invoice_table.header.date',
                        })
                    }}
                </TableHeadCell>
                <TableHeadCell>
                    {{
                        $t({
                            defaultMessage: 'Amount',
                            description:
                                'The title of the invoice amount header column of the invoice table',
                            id: 'invoice_table.header.amount',
                        })
                    }}
                </TableHeadCell>
                <TableHeadCell class="text-right">
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
            <TableRow v-for="invoice in invoices" :key="invoice.id">
                <template #link>
                    <button
                        type="button"
                        class="absolute inset-0 h-full w-full"
                        @click="handleViewInvoice(invoice.id)"
                    />
                </template>
                <TableCell has-padding class="h-14">
                    <div class="flex flex-col">
                        <Typography tag="span" variant="body-sm" class="md:hidden">
                            {{
                                formatDate({
                                    date: invoice.invoice_date,
                                    format: 'date',
                                    offsetType: 'offsetted',
                                    timezone: invoice.customer.timezone,
                                })
                            }}
                        </Typography>
                        <Typography tag="span" variant="body-xs" shade="lighter">
                            {{ invoice.invoice_number }}</Typography
                        >
                    </div>
                </TableCell>
                <TableCell class="h-14 hidden md:table-cell">
                    {{
                        formatDate({
                            date: invoice.invoice_date,
                            format: 'date',
                            offsetType: 'offsetted',
                            timezone: invoice.customer.timezone,
                        })
                    }}
                </TableCell>
                <TableCell class="h-14"
                    ><Typography tag="span" weight="semibold">
                        <Amount :value="invoice.invoice_amount_including_tax" /> </Typography
                ></TableCell>
                <TableCell class="h-14 text-right">
                    <Chip v-if="invoice.paid" color="green">
                        {{
                            $t({
                                defaultMessage: 'Paid',
                                description: 'The label of the chip for paid invoices',
                                id: 'invoice_table.chip.paid',
                            })
                        }}
                    </Chip>
                    <Button
                        v-else-if="invoice.payment_actions"
                        variant="outline"
                        color="gray"
                        size="sm"
                        type="button"
                        @click.stop="handlePayInvoice(invoice.id)"
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
</template>
