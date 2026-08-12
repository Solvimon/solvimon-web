import type {
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { BaseScreenProps } from '@/public/screens/types';

export interface SubscriptionDetailsConfiguration {
    /**
     * The subscription to show. Matches the id the `view-subscription-details` action carries, so
     * the host can hand it straight through.
     */
    subscriptionId: PricingPlanSubscription['id'];
}

export interface SubscriptionDetailsProps extends BaseScreenProps {
    /**
     * The subscription to show. Absent while it is still loading or when loading failed.
     */
    subscription?: PricingPlanSubscriptionExpanded;
    /**
     * The subscription's pricing plan schedules, rendered as the main content.
     */
    schedulesData?: PricingPlanScheduleWithPlanData[];
}
