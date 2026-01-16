import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/types';

export interface SeatsEditorItemProps {
    modelValue: ConfiguredMeterValue;
    defaultValue?: ConfiguredMeterValue;
    pricings: PricingExtended[];
}
