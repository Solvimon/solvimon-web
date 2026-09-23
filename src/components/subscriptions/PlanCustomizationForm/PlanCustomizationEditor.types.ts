import type {
    BillingPeriod,
    ConfiguredMeterValue,
    Currency,
    Pricing,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export interface PlanCustomizationEditorProps {
    subscription: PricingPlanSubscriptionExpanded;
    enabledPricingIds: Pricing['id'][];
    initialSeatsValues?: ConfiguredMeterValue[];
    initialUnitsValues?: ConfiguredMeterValue[];
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
}
