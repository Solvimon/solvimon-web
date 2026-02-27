import type { BillingPeriod, Currency, Pricing, PricingExtended } from '@solvimon/types';

export interface PricingGroupEditorBaseProps {
    modelValue: Pricing['id'][];
    pricings: PricingExtended[];
    billingPeriod: BillingPeriod;
    currency?: Currency['currencyCode'];
    groupName: string;
}
