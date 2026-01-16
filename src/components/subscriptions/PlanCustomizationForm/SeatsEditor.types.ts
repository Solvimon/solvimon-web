import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/types';

export interface SeatsEditorProps {
    modelValue: ConfiguredMeterValue[];
    initialSeatsValues?: ConfiguredMeterValue[];
    pricings: PricingExtended[];
}
