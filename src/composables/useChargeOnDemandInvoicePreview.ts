import type {
    ChargeOnDemandPricingItemsPricingItemConfig,
    Invoice,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import { computed, ref, watch, type Ref } from 'vue';
import { createInvoicesService } from '@/services/invoices';
import { useWatchDebounced } from '@/composables/useWatchDebounced';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';
import { createLatestGuard } from '@/utils/async';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Previews what charging on-demand pricing items would be invoiced for, such as a wallet top-up or
 * an on-demand order. The preview is recalculated whenever the items being charged change, and
 * cleared while there is nothing to preview.
 */
export function useChargeOnDemandInvoicePreview({
    pricingPlanScheduleId,
    pricingItems,
}: {
    pricingPlanScheduleId: Ref<PricingPlanSchedule['id'] | undefined>;
    /** Undefined until there is something to charge, which is when the preview clears. */
    pricingItems: Ref<ChargeOnDemandPricingItemsPricingItemConfig[] | undefined>;
}) {
    const { previewChargeOnDemandPricingItems } = createInvoicesService();
    const logger = useLogger();

    const invoicePreview = ref<Invoice>();
    const isRequestPending = ref(false);
    const isPreviewStale = ref(false);
    const isPreviewPending = computed(() => isRequestPending.value || isPreviewStale.value);
    const hasPreviewFailed = ref(false);

    // Only the newest request may write the preview: a slower earlier one must not overwrite it.
    const latestGuard = createLatestGuard();

    const loadPreview = async () => {
        const scheduleId = pricingPlanScheduleId.value;
        const isLatest = latestGuard();
        isPreviewStale.value = false;

        if (!scheduleId || !pricingItems.value) {
            // Items to charge but nowhere to charge them means the customer sees an amount that
            // never produces a total, so say what is missing instead of failing silently.
            if (pricingItems.value && !scheduleId) {
                logger.warn(
                    'INVOICE_PREVIEW_SKIPPED',
                    'Skipped the on-demand charge invoice preview: no schedule to charge it on',
                    { missing: ['pricingPlanScheduleId'] },
                );
            }

            invoicePreview.value = undefined;
            isRequestPending.value = false;
            hasPreviewFailed.value = false;
            return;
        }

        isRequestPending.value = true;
        hasPreviewFailed.value = false;

        try {
            const invoice = await previewChargeOnDemandPricingItems({
                pricingPlanScheduleId: scheduleId,
                pricingItems: pricingItems.value,
            });

            if (isLatest()) {
                invoicePreview.value = invoice;
            }
        } catch (error) {
            if (isLatest()) {
                invoicePreview.value = undefined;
                hasPreviewFailed.value = true;
            }

            logger.error(
                'INVOICE_PREVIEW_FAILED',
                'Failed to load the invoice preview',
                { preview: 'ON_DEMAND_CHARGE' },
                error,
            );
        } finally {
            if (isLatest()) {
                isRequestPending.value = false;
            }
        }
    };

    // Only the first preview for a selection goes out straight away. After that, including after a
    // failed preview, typing settles first so each keystroke is not its own request.
    useWatchDebounced(pricingItems, () => void loadPreview(), {
        debounce: () =>
            invoicePreview.value || isRequestPending.value || hasPreviewFailed.value
                ? PREVIEW_DEBOUNCE_MS
                : 0,
        deep: true,
    });

    watch(
        pricingItems,
        () => {
            isPreviewStale.value = true;
        },
        { deep: true, flush: 'sync' },
    );

    void loadPreview();

    return { invoicePreview, isPreviewPending, hasPreviewFailed, loadPreview };
}
