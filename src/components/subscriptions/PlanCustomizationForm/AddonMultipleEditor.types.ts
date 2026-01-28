import type { Pricing, PricingExtended } from '@solvimon/types';

export interface AddonMultipleEditorProps {
    modelValue: Pricing['id'][];
    pricings: PricingExtended[];
    groupName?: string;
}
