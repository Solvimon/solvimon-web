import type { Invoice, PricingPlan, PricingPlanSubscription } from '@solvimon/solvimon-types';
import { ref, type Ref } from 'vue';
import { createInvoicesService } from '@/services/invoices';
import { useLogger } from '@/components/providers';
import { createLatestGuard } from '@/utils/async';

/**
 * What the customer would be invoiced if the subscription moved to another plan in its group: the
 * invoice raised where the new schedule starts, settling the plan being left. Nothing is moved —
 * the preview endpoint only calculates.
 *
 * Only the newest request may write the result, so a slow one cannot overwrite a later choice.
 */
export function useSubscriptionPlanChangePreview(): {
    invoice: Ref<Invoice | undefined>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    load: (args: {
        subscriptionId: PricingPlanSubscription['id'];
        pricingPlanId: PricingPlan['id'];
    }) => Promise<void>;
    /** Drops the preview, and any request still out, once there is no move to price. */
    reset: () => void;
} {
    const { getChangePlanInvoicePreview } = createInvoicesService();
    const logger = useLogger();

    const invoice = ref<Invoice>();
    const isPending = ref(false);
    const error = ref<unknown>();

    const latestGuard = createLatestGuard();

    const reset = () => {
        latestGuard();
        invoice.value = undefined;
        error.value = undefined;
        isPending.value = false;
    };

    const load = async ({
        subscriptionId,
        pricingPlanId,
    }: {
        subscriptionId: PricingPlanSubscription['id'];
        pricingPlanId: PricingPlan['id'];
    }) => {
        const isLatest = latestGuard();

        // The previous plan's price must not stand in for this one while it loads.
        invoice.value = undefined;
        isPending.value = true;
        error.value = undefined;

        try {
            const response = await getChangePlanInvoicePreview({
                id: subscriptionId,
                pricingPlanId,
            });

            if (!isLatest()) return;

            invoice.value = response;
        } catch (previewError) {
            if (!isLatest()) return;

            logger.error(
                'INVOICE_PREVIEW_FAILED',
                'Failed to load the invoice preview',
                { preview: 'PLAN_CHANGE' },
                previewError,
            );
            error.value = previewError;
        } finally {
            if (isLatest()) {
                isPending.value = false;
            }
        }
    };

    return { invoice, isPending, error, load, reset };
}
