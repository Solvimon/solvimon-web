<script setup lang="ts">
import { InvoicePreview, Section, Typography, useIntl } from '@solvimon/ui';
import SubscriptionSummary from './SubscriptionSummary.vue';
import type { OrderSummaryProps } from './OrderSummary.types';

defineProps<OrderSummaryProps>();

const { $t } = useIntl();
</script>

<template>
    <Section
        no-border
        no-spacing
        content-background="none"
        :title="
            noTitle
                ? undefined
                : $t({
                      defaultMessage: 'Order summary',
                      id: 'checkout.order_summary_block.title',
                      description:
                          'The title of the order summary block that lists the subscription cost in the checkout',
                  })
        "
    >
        <div class="grid grid-cols-1 gap-1">
            <!-- subscription summary -->
            <Section no-spacing>
                <SubscriptionSummary
                    v-if="subscription"
                    :avatar="avatar"
                    :invoice="invoice"
                    :subscription="subscription"
                    :enabled-pricing-ids="enabledPricingIds"
                    :loading="isPreviewAndPaymentMethodsPending"
                    :trial-period="trialPeriod"
                />
            </Section>

            <!-- usage based -->
            <Section v-if="isUsageBased" no-spacing>
                <div class="px-3 py-2">
                    <Typography no-spacing variant="body-sm" shade="lighter">
                        {{
                            $t({
                                defaultMessage: '+ Usage',
                                id: 'checkout.invoice_preview.usage_based_message',
                                description:
                                    'The message shown for the usage based invoice preview',
                            })
                        }}
                    </Typography>
                </div>
            </Section>

            <!-- invoice preview -->
            <Section>
                <InvoicePreview
                    v-if="invoice"
                    :invoice="invoice"
                    :trial-invoice="trialInvoice"
                    :variant="trialInvoice ? 'without-products' : 'default'"
                    :is-paid="isPaid"
                    :collapsible="collapsible"
                    :is-preview-without-taxes="!countryCode"
                    is-customer-facing
                />
                <Typography v-else variant="body-sm" shade="lighter"
                    >{{
                        $t({
                            defaultMessage: 'Please select a country first',
                            description:
                                'The message shown for the invoice preview when no country is set',
                            id: 'checkout.invoice_preview.no_country_selected_message',
                        })
                    }}
                </Typography>
            </Section>
        </div>
    </Section>
</template>
