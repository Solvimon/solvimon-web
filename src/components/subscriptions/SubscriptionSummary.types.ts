import type { Pricing, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';

export interface SubscriptionSummaryProps {
    /**
     * The subscription to display.
     */
    subscription: PricingPlanSubscriptionExpanded;
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
}
