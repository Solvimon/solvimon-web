import type { Pricing, PricingExtended } from '@solvimon/types';

export interface PricingGroupMultiEditorProps {
    modelValue: Pricing['id'][];
    groupName: string;
    pricings: PricingExtended[];
}
