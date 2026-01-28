import type {
    ConfiguredMeterValue,
    Pricing,
    PricingExtended,
    PricingGroupExtended,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';

export interface PlanCustomizationEditorProps {
    subscription: PricingPlanSubscriptionExpanded;
    enabledPricingIds: Pricing['id'][];
    initialSeatsValues?: ConfiguredMeterValue[];
    pricings: PricingExtended[];
    pricingGroups: PricingGroupExtended[];
}
