import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import { useService } from '@/composables/useService';
import { createSubscriptionsService } from '@/services/subscriptions';

export function useSubscription({
    subscriptionId,
}: {
    subscriptionId: PricingPlanSubscription['id'];
}) {
    const { getSubscription } = createSubscriptionsService();
    const {
        data,
        execute: get,
        apiStatus,
        error,
        isPending,
    } = useService({
        service: () => getSubscription({ id: subscriptionId, expanded: true }),
    });

    return { subscription: data, apiStatus, error, get, isPending };
}
