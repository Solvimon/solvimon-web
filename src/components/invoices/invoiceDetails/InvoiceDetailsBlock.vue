<script setup lang="ts">
import { Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import type { Invoice } from '@solvimon/solvimon-types';

defineProps<{
    invoice: Invoice;
}>();

const { $t, formatDate } = useIntl();
</script>

<template>
    <Section
        class="sv-invoice-details"
        :title="
            $t({
                defaultMessage: 'Invoice details',
                description: 'Title for the invoice details block on the invoice overview page',
                id: 'sdk.invoice_details.invoice_details_block.title',
            })
        "
    >
        <div v-if="invoice" class="sv-invoice-details__body flex flex-col gap-2">
            <div class="sv-invoice-details__row">
                <Typography variant="caps-heading" class="sv-invoice-details__label">
                    {{
                        $t({
                            defaultMessage: 'Invoice date',
                            description:
                                'Title for the invoice date in invoice details block on the invoice overview page',
                            id: 'sdk.invoice_details.invoice_details_block.invoice_date',
                        })
                    }}
                </Typography>
                <Typography
                    v-if="invoice.invoice_date"
                    variant="body-xs"
                    class="sv-invoice-details__value"
                >{{
                    formatDate({
                        date: invoice.invoice_date,
                        format: 'date',
                        timezone: invoice.customer.timezone,
                        offsetType: 'offsetted',
                    })
                }}</Typography>
            </div>
            <div class="sv-invoice-details__row">
                <Typography variant="caps-heading" class="sv-invoice-details__label">
                    {{
                        $t({
                            defaultMessage: 'Due date',
                            description:
                                'Title for the due date in invoice details block on the invoice overview page',
                            id: 'sdk.invoice_details.invoice_details_block.due_date',
                        })
                    }}
                </Typography>
                <Typography
                    v-if="invoice.due_date"
                    variant="body-xs"
                    class="sv-invoice-details__value"
                >{{
                    formatDate({
                        date: invoice.due_date,
                        format: 'date',
                        timezone: invoice.customer.timezone,
                        offsetType: 'offsetted',
                    })
                }}</Typography>
            </div>
        </div>
    </Section>
</template>
