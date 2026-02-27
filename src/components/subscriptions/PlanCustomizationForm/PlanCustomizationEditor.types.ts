import type {
    BillingPeriod,
    ConfiguredMeterValue,
    Currency,
    Pricing,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';

export interface PlanCustomizationEditorProps {
    subscription: PricingPlanSubscriptionExpanded;
    enabledPricingIds: Pricing['id'][];
    initialSeatsValues?: ConfiguredMeterValue[];
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
}
