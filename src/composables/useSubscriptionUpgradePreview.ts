import type { Invoice, Pricing } from '@solvimon/solvimon-types';
import { ref, type Ref } from 'vue';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { createInvoicesService } from '@/services/invoices';
import { useLogger } from '@/components/providers';
import { getScheduleCustomizations } from '@/utils/pricingPlanSchedule';
import { createLatestGuard } from '@/utils/async';

/**
 * What the customer would be invoiced if the subscription's enabled pricings were changed to the
 * ones given. Nothing is created — the preview endpoint only calculates.
 *
 * Only the newest request may write the result, so a slow one cannot overwrite a later choice.
 */
export function useSubscriptionUpgradePreview(): {
    invoice: Ref<Invoice | undefined>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    load: (args: {
        subscription: PricingPlanSubscriptionExpanded;
        enabledPricingIds: Pricing['id'][];
    }) => Promise<void>;
} {
    const { getInvoicePreview } = createInvoicesService();
    const logger = useLogger();

    const invoice = ref<Invoice>();
    const isPending = ref(false);
    const error = ref<unknown>();

    const latestGuard = createLatestGuard();

    const load = async ({
        subscription,
        enabledPricingIds,
    }: {
        subscription: PricingPlanSubscriptionExpanded;
        enabledPricingIds: Pricing['id'][];
    }) => {
        const customizations = getScheduleCustomizations({
            enabledPricings: enabledPricingIds.map((pricingId) => ({ pricing_id: pricingId })),
            pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
        });

        // No DEFAULT schedule means there is nothing to bill the change on.
        if (!customizations) {
            invoice.value = undefined;
            return;
        }

        const isLatest = latestGuard();

        isPending.value = true;
        error.value = undefined;

        try {
            const response = await getInvoicePreview({
                // The subscription is running already, so it is priced as itself rather than as the
                // template for a new one — and the customer it is invoiced to is known.
                forExistingSubscription: true,
                pricingPlanSubscriptionId: subscription.id,
                customizations,
            });

            if (!isLatest()) return;

            invoice.value = response.invoice;
        } catch (previewError) {
            if (!isLatest()) return;

            logger.error(
                'INVOICE_PREVIEW_FAILED',
                'Failed to preview the subscription upgrade',
                {},
                previewError,
            );
            error.value = previewError;
            invoice.value = undefined;
        } finally {
            if (isLatest()) {
                isPending.value = false;
            }
        }
    };

    return { invoice, isPending, error, load };
}
