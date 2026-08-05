import type {
    ConfiguredMeterValue,
    Customer,
    Pricing,
    PricingPlanSchedule,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export interface LoadInvoicePreviewParams {
    subscription: PricingPlanSubscriptionExpanded;
    subscriptionStartAt?: PricingPlanSchedule['start_at'];
    customer?: Partial<Customer>;
    seatsValues?: ConfiguredMeterValue[];
    enabledPricingIds?: Pricing['id'][];
    promotionCode?: string | null;
}
