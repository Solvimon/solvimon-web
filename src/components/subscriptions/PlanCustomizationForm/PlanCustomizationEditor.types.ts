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
    /** The highest number of each seat and unit config, by config. */
    maxSeatsValues?: ConfiguredMeterValue[];
    maxUnitsValues?: ConfiguredMeterValue[];
    /** The seat and unit configs that can be changed; every config when left out. */
    editableConfigIds?: string[];
    /** Leaves out the pricing groups and add-ons, for an order whose pricings are fixed. */
    hidePricingChoices?: boolean;
    /** Replaces the default title. */
    title?: string;
}
