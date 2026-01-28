import type { Pricing, PricingExtended, PricingGroupExtended } from '@solvimon/types';

export interface AddonSingleEditorProps {
    modelValue: Pricing['id'][];
    groupName: string;
    constraint: PricingGroupExtended['selection_constraint'];
    pricings: PricingExtended[];
}
