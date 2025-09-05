import type { Invoice } from '@solvimon/types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionSummaryProps {
    subscription: PricingPlanSubscriptionExpanded;
    invoice?: Invoice;
    loading?: boolean;
}
