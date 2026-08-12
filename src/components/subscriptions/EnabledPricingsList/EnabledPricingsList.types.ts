import type {
    Amount,
    BillingPeriod,
    Pricing,
    PricingGroup,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';

export interface EnabledPricingsListProps {
    pricingPlanSchedule: PricingPlanScheduleInfoExpanded;
}

export interface EnabledPricingsListEntry {
    pricingId: Pricing['id'];
    pricingGroupId: PricingGroup['id'];
    groupName: string;
    name: string;
    amount?: Amount;
    billingPeriod?: BillingPeriod;
}

export interface EnabledPricingsListEmits {
    (e: 'upgrade', entry: EnabledPricingsListEntry): void;
}
