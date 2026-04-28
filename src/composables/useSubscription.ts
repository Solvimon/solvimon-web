import type {
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscription,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { useService } from '@/composables/useService';
import { createSubscriptionsService } from '@/services/subscriptions';

export function useSubscription({
    subscriptionId,
}: {
    subscriptionId: PricingPlanSubscription['id'];
}) {
    const { getSubscription } = createSubscriptionsService();
    const { data, execute: get, apiStatus, error, isPending } = useService({
        service: () => getSubscription({ id: subscriptionId, expanded: true }),
    });

    const withPlanData = (
        subscription: PricingPlanSubscriptionExpanded,
    ): PricingPlanScheduleWithPlanData[] => {
        return subscription.pricing_plan_schedule_infos.map((schedule) => {
            return {
                schedule: schedule.pricing_plan_schedule,
                selectedPricingPlan: schedule.pricing_plan_version.pricing_plan,
                selectedPricingPlanVersion: schedule.pricing_plan_version,
            };
        });
    };

    return { subscription: data, withPlanData, apiStatus, error, get, isPending };
}
