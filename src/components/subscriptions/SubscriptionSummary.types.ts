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
     * Drops the summary's own padding, for callers whose row already provides it — a radio option,
     * for instance, which would otherwise pad it twice over.
     */
    noSpacing?: boolean;
    /**
     * The trial period to display.
     */
    trialPeriod?: TimePeriod;
}
