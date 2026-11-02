import type { PricingPlan } from '@solvimon/solvimon-types';
import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

export interface SubscriptionPlanSelectorProps {
    /** The plans of the group, cheapest first, with the one being billed today among them. */
    options: SubscriptionPlanOption[];
    disabled?: boolean;
    avatar?: string;
}

export interface SubscriptionPlanSelectorModel {
    pricingPlanId?: PricingPlan['id'];
}
