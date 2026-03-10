import type { Customer, PricingPlanSubscriptionExpanded } from '@solvimon/types';
import { useIncrementalLoading } from '@/composables/useIncrementalLoading';
import { createSubscriptionsService } from '@/services/subscriptions';

export function useSubscriptionsList({
    customerId,
    batchSize: pageSize = 15,
}: {
    customerId: Customer['id'];
    batchSize?: number;
}) {
    const subscriptionsService = createSubscriptionsService();

    const service = async (page: number) =>
        subscriptionsService.getActiveSubscriptions({
            customerId,
            pagination: { page, pageSize },
        });

    return useIncrementalLoading<PricingPlanSubscriptionExpanded>({ service });
}
