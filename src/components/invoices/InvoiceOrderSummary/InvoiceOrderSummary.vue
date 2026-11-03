<script setup lang="ts">
import {
    Amount as AmountDisplay,
    Divider,
    Section,
    Typography,
    useIntl,
} from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { InvoiceOrderSummaryProps } from './InvoiceOrderSummary.types';
import OrderSummaryInvoice from '@/components/subscriptions/OrderSummaryInvoice.vue';
import TranslationOverride from '@/components/providers/TranslationProvider/TranslationOverride.vue';
import { sumAmounts } from '@/utils/amount';
import { getInvoiceTimezone } from '@/utils/invoiceState';

/** The invoice being paid, laid out as the checkout's order summary lays out what is bought. */
const props = defineProps<InvoiceOrderSummaryProps>();

const { $t, formatDate } = useIntl();

/** The total is what the invoice comes to; what is still due is shown below it when that differs. */
const messages = computed(() => ({
    'invoice_preview.total_due_today_heading': $t({
        defaultMessage: 'Total',
        id: 'pay_invoice.order_summary.total_heading',
        description:
            'Heading of the invoice total in the order summary of the pay invoice screen, replacing the shared preview’s "Total due today"',
    }),
}));

const amountDue = computed(() => props.invoice.open_invoice_amount);

const negate = (quantity: string) =>
    quantity.startsWith('-') ? quantity.slice(1) : `-${quantity}`;

/** Only while something is still due: on a paid invoice the total says it all. */
const alreadyPaid = computed(() => {
    const total = props.invoice.tax_summary.total_amount;
    const due = amountDue.value;

    if (props.isPaid || props.invoice.paid || !due) return undefined;
    if (Number(due.quantity) === Number(total.quantity)) return undefined;

    return sumAmounts(
        [total, { ...due, quantity: negate(due.quantity) }],
        props.invoice.billing_currency,
    );
});
</script>

<template>
    <Section
        class="sv-order-summary sv-invoice-order-summary"
        no-border
        no-spacing
        content-background="none"
        :title="
            $t({
                defaultMessage: 'Invoice summary',
                id: 'pay_invoice.order_summary.title',
                description: 'Title of the block listing what the invoice being paid is for',
            })
        "
    >
        <div class="sv-order-summary__body grid grid-cols-1 gap-1">
            <Section no-spacing class="sv-invoice-order-summary__invoice">
                <div class="flex flex-row gap-3 px-3 py-2">
                    <div class="min-w-0 grow">
                        <Typography variant="body" weight="semibold" no-spacing class="truncate">{{
                            $t(
                                {
                                    defaultMessage: 'Invoice {number}',
                                    id: 'pay_invoice.order_summary.invoice_number',
                                    description:
                                        'Names the invoice being paid at the top of its order summary',
                                },
                                { number: invoice.invoice_number },
                            )
                        }}</Typography>
                        <Typography
                            v-if="invoice.due_date"
                            variant="body-xs"
                            color="subtle"
                            no-spacing
                            class="sv-invoice-order-summary__due-date"
                            >{{
                                $t(
                                    {
                                        defaultMessage: 'Due on {date}',
                                        id: 'pay_invoice.order_summary.due_date',
                                        description:
                                            'When the invoice being paid is due, under its number in the order summary',
                                    },
                                    {
                                        date: formatDate({
                                            date: invoice.due_date,
                                            format: 'date',
                                            timezone: getInvoiceTimezone(invoice),
                                            offsetType: 'offsetted',
                                        }),
                                    },
                                )
                            }}</Typography
                        >
                    </div>
                </div>
            </Section>

            <TranslationOverride :messages="messages">
                <OrderSummaryInvoice :invoice="invoice" :is-paid="isPaid">
                    <template v-if="alreadyPaid && amountDue">
                        <div class="sv-invoice-order-summary__paid flex flex-row gap-2 py-1.5">
                            <Typography tag="span" variant="body-xs" class="grow">{{
                                $t({
                                    defaultMessage: 'Already paid',
                                    id: 'pay_invoice.order_summary.already_paid',
                                    description:
                                        'What has been paid on the invoice so far, in its order summary',
                                })
                            }}</Typography>
                            <Typography tag="span" variant="body-xs">
                                <AmountDisplay :value="alreadyPaid" />
                            </Typography>
                        </div>
                        <Divider spacing="xxs" />
                        <div class="sv-invoice-order-summary__due flex flex-row gap-2 py-1.5">
                            <Typography
                                tag="span"
                                variant="body-sm"
                                weight="semibold"
                                class="grow"
                                >{{
                                    $t({
                                        defaultMessage: 'Amount due',
                                        id: 'pay_invoice.order_summary.amount_due',
                                        description:
                                            'What is still to be paid on the invoice, in its order summary',
                                    })
                                }}</Typography
                            >
                            <Typography tag="span" variant="body-sm" weight="semibold">
                                <AmountDisplay :value="amountDue" />
                            </Typography>
                        </div>
                    </template>
                </OrderSummaryInvoice>
            </TranslationOverride>
        </div>
    </Section>
</template>
