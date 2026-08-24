import type {
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { useService } from '@/composables/useService';
import { createSubscriptionsService } from '@/services/subscriptions';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import { getSchedulesWithPlanData } from '@/utils/pricingPlanScheduleOverrides';

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

    /**
     * The schedules as `PricingPlanSchedules` renders them, with the price customizations the
     * schedule carries merged into the plan version — the portal endpoints do not serve the
     * combined version desk reads them from.
     */
    const withPlanData = (
        subscription: PricingPlanSubscriptionExpanded,
    ): PricingPlanScheduleWithPlanData[] => getSchedulesWithPlanData(subscription);

    return { subscription: data, withPlanData, apiStatus, error, get, isPending };
}
