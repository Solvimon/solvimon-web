import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/solvimon-types';

export interface UnitsEditorProps {
    modelValue: ConfiguredMeterValue[];
    initialUnitsValues?: ConfiguredMeterValue[];
    pricings: PricingExtended[];
}
