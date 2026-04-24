import type { PricingPlanSubscription } from '@solvimon/types';
import type { PricingPlanScheduleWithPlanData } from '@solvimon/types';

export interface SubscriptionSchedulesConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
}

export interface SubscriptionSchedulesProps {
    schedulesData: PricingPlanScheduleWithPlanData[];
    configuration: SubscriptionSchedulesConfiguration;
    isLoading?: boolean;
}
