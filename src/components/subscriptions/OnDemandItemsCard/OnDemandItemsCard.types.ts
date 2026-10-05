import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface OnDemandItemsCardProps {
    subscription: PricingPlanSubscriptionExpanded;
}

export interface OnDemandItemsCardEmits {
    (e: 'order'): void;
}
