import type { PricingPlanGroupChangeType } from '@/types/pricingPlanGroup';

export interface SubscriptionPlanChangeSummaryProps {
    /** How the group times the move, which is what decides the dating of the charge. */
    changeType?: PricingPlanGroupChangeType;
}
