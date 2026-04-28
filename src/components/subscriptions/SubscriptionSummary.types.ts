import type { Invoice, Pricing, TimePeriod } from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionSummaryProps {
    /**
     * The subscription to display.
     */
    subscription: PricingPlanSubscriptionExpanded;
    /**
     * The invoice to display.
     */
    invoice?: Invoice;
    /**
     * Whether the subscription is loading.
     */
    loading?: boolean;
    /**
     * The pricing ids to display.
     */
    enabledPricingIds?: Pricing['id'][];
    /**
     * The avatar to display.
     */
    avatar?: string;
    /**
     * The trial period to display.
     */
    trialPeriod?: TimePeriod;
}
