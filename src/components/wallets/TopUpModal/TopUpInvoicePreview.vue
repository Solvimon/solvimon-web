<script setup lang="ts">
import { computed } from 'vue';
import { InvoicePreview, Label, Section, useIntl } from '@solvimon/solvimon-ui';
import type { TopUpInvoicePreviewProps } from './TopUpInvoicePreview.types';
import { useTopUpInvoicePreview } from './useTopUpInvoicePreview';
import Skeleton from '@/components/shared/Skeleton.vue';

const props = defineProps<TopUpInvoicePreviewProps>();

const { $t } = useIntl();

const pricingPlanScheduleId = computed(() => props.pricingPlanScheduleId);
const pricingItems = computed(() => props.pricingItems);

/**
 * The preview is fetched here rather than by the form around it: every caller wants the same request
 * for the same reason, and a caller that only passes what it is charging cannot get the two out of
 * step with what is on screen.
 */
const { invoicePreview } = useTopUpInvoicePreview({ pricingPlanScheduleId, pricingItems });
</script>

<template>
    <!--
        Holds the height a preview comes back at until one has, so the modal neither jumps as the
        request lands nor leaves a gap where the total is going to be while the customer is still
        deciding what to charge.
    -->
    <Skeleton
        class="sv-top-up-invoice-preview h-[152px]"
        data-testid="top-up-invoice-preview-skeleton"
    >
        <!--
            One element for the placeholder to step aside for. `Skeleton` gives way to any slot content
            at all, so a section that renders whether or not the preview has landed would leave an
            empty box standing in for it.
        -->
        <div v-if="invoicePreview">
            <Label required>{{
                $t({
                    defaultMessage: 'You will pay',
                    description: 'Label above the preview of what topping up will be invoiced for',
                    id: 'topup_modal.invoice_preview.label',
                })
            }}</Label>

            <Section content-background="none">
                <InvoicePreview :invoice="invoicePreview" is-customer-facing />
            </Section>
        </div>
    </Skeleton>
</template>
