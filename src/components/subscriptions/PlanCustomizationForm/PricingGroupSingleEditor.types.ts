import type { Pricing, PricingExtended } from '@solvimon/types';

export interface PricingGroupSingleEditorProps {
    modelValue: Pricing['id'][];
    pricings: PricingExtended[];
    groupName: string;
}
