import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/solvimon-types';

export interface SeatsEditorProps {
    modelValue: ConfiguredMeterValue[];
    initialSeatsValues?: ConfiguredMeterValue[];
    pricings: PricingExtended[];
    /** The highest number of each config, by config. */
    maxValues?: ConfiguredMeterValue[];
    /** The configs that can be changed; every config when left out. */
    editableConfigIds?: string[];
}
