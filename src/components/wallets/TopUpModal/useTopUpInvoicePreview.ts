import type {
    ChargeOnDemandPricingItemsPricingItemConfig,
    Invoice,
    PricingPlanSchedule,
} from '@solvimon/solvimon-types';
import { ref, type Ref } from 'vue';
import { createInvoicesService } from '@/services/invoices';
import { useWatchDebounced } from '@/composables/useWatchDebounced';
import { useLogger } from '@/components/providers/LoggerProvider/composables/useLogger';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Previews what topping up would be invoiced for. The preview is recalculated whenever the items
 * being charged change, and cleared while there is nothing to preview.
 */
export function useTopUpInvoicePreview({
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
    const isPreviewPending = ref(false);

    // Only the newest request may write the preview: a slower earlier one must not overwrite it.
    let latestRequestId = 0;

    const loadPreview = async () => {
        const scheduleId = pricingPlanScheduleId.value;
        const requestId = ++latestRequestId;

        if (!scheduleId || !pricingItems.value) {
            // Items to charge but nowhere to charge them means the customer sees an amount that
            // never produces a total, so say what is missing instead of failing silently.
            if (pricingItems.value && !scheduleId) {
                logger.warn(
                    'INVOICE_PREVIEW_SKIPPED',
                    'Skipped the top-up invoice preview: no schedule to charge it on',
                    { missing: ['pricingPlanScheduleId'] },
                );
            }

            invoicePreview.value = undefined;
            isPreviewPending.value = false;
            return;
        }

        isPreviewPending.value = true;

        try {
            const invoice = await previewChargeOnDemandPricingItems({
                pricingPlanScheduleId: scheduleId,
                pricingItems: pricingItems.value,
            });

            if (requestId === latestRequestId) {
                invoicePreview.value = invoice;
            }
        } catch (error) {
            if (requestId === latestRequestId) {
                invoicePreview.value = undefined;
            }

            logger.error(
                'INVOICE_PREVIEW_FAILED',
                'Failed to load top-up invoice preview',
                {},
                error,
            );
        } finally {
            if (requestId === latestRequestId) {
                isPreviewPending.value = false;
            }
        }
    };

    useWatchDebounced(pricingItems, () => void loadPreview(), {
        debounce: PREVIEW_DEBOUNCE_MS,
        deep: true,
    });

    // A watcher only sees changes, and a top-up chosen while the form is still being built is not one:
    // the choose-your-amount option is selected and seeded with its minimum during setup, so without
    // this first ask its placeholder would sit there for good. Undebounced — there is nothing yet to
    // debounce against — and a no-op when there is nothing to price.
    void loadPreview();

    return { invoicePreview, isPreviewPending, loadPreview };
}
