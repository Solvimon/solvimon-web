import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import type { PricingPlanScheduleWithPlanData } from '@solvimon/solvimon-types';

export interface SubscriptionSchedulesConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
}

export interface SubscriptionSchedulesProps {
    schedulesData: PricingPlanScheduleWithPlanData[];
    configuration: SubscriptionSchedulesConfiguration;
    isLoading?: boolean;
}
