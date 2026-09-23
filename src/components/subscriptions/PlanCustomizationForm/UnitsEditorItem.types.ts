import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/solvimon-types';

export interface UnitsEditorItemProps {
    modelValue: ConfiguredMeterValue;
    defaultValue?: ConfiguredMeterValue;
    pricings: PricingExtended[];
}
