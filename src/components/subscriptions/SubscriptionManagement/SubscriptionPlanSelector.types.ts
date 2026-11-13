import type { SubscriptionPlanOption } from '@/composables/useSubscriptionPlanGroup';

export interface SubscriptionPlanSelectorProps {
    /** Cheapest first, the current plan among them. */
    options: SubscriptionPlanOption[];
    disabled?: boolean;
    avatar?: string;
}
