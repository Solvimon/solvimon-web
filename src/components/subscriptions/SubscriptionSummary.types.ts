import type { Invoice, Pricing, TimePeriod } from '@solvimon/types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionSummaryProps {
    subscription: PricingPlanSubscriptionExpanded;
    invoice?: Invoice;
    loading?: boolean;
    enabledPricingIds?: Pricing['id'][];
    avatar?: string;
    trialPeriod?: TimePeriod;
}
