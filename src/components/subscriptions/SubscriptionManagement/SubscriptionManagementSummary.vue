<script setup lang="ts">
import { ErrorNotification, InvoicePreview, Section, Typography, useIntl } from '@solvimon/solvimon-ui';
import { computed } from 'vue';
import type { SubscriptionManagementSummaryProps } from './SubscriptionManagementSummary.types';
import Skeleton from '@/components/shared/Skeleton.vue';
import TranslationOverride from '@/components/providers/TranslationProvider/TranslationOverride.vue';

defineProps<SubscriptionManagementSummaryProps>();

const { $t } = useIntl();

/**
 * A change is invoiced on the schedule's own terms rather than charged on the spot, so the shared
 * preview's "Total due today" would promise a date this screen cannot.
 */
const invoicePreviewMessages = computed(() => ({
    'invoice_preview.total_due_today_heading': $t({
        defaultMessage: 'Total due',
        id: 'subscription_management.summary.total_due_heading',
        description:
            'Heading above the total of the invoice previewing a subscription change, replacing the shared preview’s "Total due today"',
    }),
}));
</script>

<template>
    <Section
        class="sv-subscription-management-summary"
        :title="
            $t({
                defaultMessage: 'Order summary',
                id: 'subscription_management.summary.title',
                description: 'Title of the block previewing what a subscription change is invoiced for',
            })
        "
    >
        <ErrorNotification
            v-if="hasError"
            class="sv-subscription-management-summary__error sv-error"
            :title="
                $t({
                    defaultMessage: 'Unable to calculate the total. Please try again.',
                    id: 'subscription_management.summary.error',
                    description:
                        'Error shown when the invoice preview for a subscription change cannot be loaded',
                })
            "
        />

        <Skeleton
            v-else-if="isPending || !invoice"
            variant="section"
            class="sv-subscription-management-summary__skeleton min-h-[120px]"
        >
            <Typography
                v-if="!isPending"
                variant="body-sm"
                shade="lighter"
                tag="div"
                class="sv-subscription-management-summary__empty-state"
                >{{
                    $t({
                        defaultMessage: 'Select your plan to see what it costs.',
                        id: 'subscription_management.summary.empty_state',
                        description:
                            'Shown in the order summary before a plan has been picked to preview',
                    })
                }}
            </Typography>
        </Skeleton>

        <TranslationOverride v-else :messages="invoicePreviewMessages">
            <InvoicePreview
                class="sv-subscription-management-summary__invoice"
                :invoice="invoice"
                is-customer-facing
            />
        </TranslationOverride>
    </Section>
</template>
