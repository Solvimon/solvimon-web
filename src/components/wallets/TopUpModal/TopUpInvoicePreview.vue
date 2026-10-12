<script setup lang="ts">
import { computed } from 'vue';
import { ErrorNotification, InvoicePreview, Label, Section, useIntl } from '@solvimon/solvimon-ui';
import type { TopUpInvoicePreviewProps } from './TopUpInvoicePreview.types';
import { useChargeOnDemandInvoicePreview } from '@/composables/useChargeOnDemandInvoicePreview';
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
const { invoicePreview, isPreviewPending, hasPreviewFailed } = useChargeOnDemandInvoicePreview({
    pricingPlanScheduleId,
    pricingItems,
});

const previewError = computed(() =>
    hasPreviewFailed.value && !isPreviewPending.value
        ? $t({
              defaultMessage: 'Unable to calculate the total. Please try again.',
              description: 'Shown in place of the top-up total when it failed to load',
              id: 'topup_modal.invoice_preview.error',
          })
        : undefined,
);
</script>

<template>
    <ErrorNotification
        v-if="previewError"
        class="sv-top-up-invoice-preview sv-top-up-invoice-preview--error sv-error"
        :title="previewError"
    />
    <!--
        Holds the height a preview comes back at until one has, so the modal neither jumps as the
        request lands nor leaves a gap where the total is going to be while the customer is still
        deciding what to charge.
    -->
    <Skeleton
        v-else
        class="sv-top-up-invoice-preview h-[152px]"
        data-testid="top-up-invoice-preview-skeleton"
    >
        <!--
            One element for the placeholder to step aside for. `Skeleton` gives way to any slot content
            at all, so a section that renders whether or not the preview has landed would leave an
            empty box standing in for it. Dimmed while a change is repriced, so a total that no longer
            applies does not read as current.
        -->
        <div
            v-if="invoicePreview"
            :class="{ 'opacity-60': isPreviewPending }"
            :aria-busy="isPreviewPending"
            data-testid="top-up-invoice-preview"
        >
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
