import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

export interface SubscriptionPlanSelectorProps {
    /** The plans of the group, cheapest first, with the one being billed today among them. */
    options: SubscriptionPlanOption[];
    /** Names the choice — "Workspace plans". Falls back to a generic heading. */
    groupName?: string;
    disabled?: boolean;
}

export interface SubscriptionPlanSelectorModel {
    pricingPlanId?: PricingPlan['id'];
}
