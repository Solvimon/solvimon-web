import type {
    ConfiguredMeterValue,
    Pricing,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';

export interface PlanCustomizationEditorProps {
    subscription: PricingPlanSubscriptionExpanded;
    enabledPricingIds: Pricing['id'][];
    initialSeatsValues?: ConfiguredMeterValue[];
}
