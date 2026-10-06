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
    /**
     * The items changed and their preview has not been asked for yet. Until it has, the preview on
     * screen is for the previous items, so it must not be charged on.
     */
    const isPreviewStale = ref(false);
    const isPreviewPending = computed(() => isRequestPending.value || isPreviewStale.value);
    /** The newest request failed, so there is no total to show until the preview is asked again. */
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

    // Debounced so that typing an amount sends one request, not one per keystroke. The first request
    // is sent straight away: with no preview yet and none on its way, there is nothing to wait for.
    useWatchDebounced(pricingItems, () => void loadPreview(), {
        debounce: () => (invoicePreview.value || isRequestPending.value ? PREVIEW_DEBOUNCE_MS : 0),
        deep: true,
    });

    // Marked on the change itself, ahead of the debounce, which always follows with `loadPreview`.
    watch(
        pricingItems,
        () => {
            isPreviewStale.value = true;
        },
        { deep: true, flush: 'sync' },
    );

    // The watcher above only fires when the items change, not for the items the form starts with.
    // A top-up, for example, preselects its choose-your-amount option with the minimum amount during
    // setup, so the first preview has to be requested here. It does nothing while there are no items.
    void loadPreview();

    return { invoicePreview, isPreviewPending, hasPreviewFailed, loadPreview };
}
