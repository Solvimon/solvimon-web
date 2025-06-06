import type {
    PricingPlanSubscriptionExpanded as OriginalPricingPlanSubscriptionExpanded,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/types';

export interface PricingPlanSubscriptionExpanded
    extends Omit<OriginalPricingPlanSubscriptionExpanded, 'pricing_plan_schedule_infos'> {
    pricing_plan_schedule_infos: PricingPlanScheduleInfoExpanded[];
}
