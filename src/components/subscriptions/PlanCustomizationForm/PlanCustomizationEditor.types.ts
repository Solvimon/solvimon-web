import type { ConfiguredMeterValue, PricingExtended } from '@solvimon/types';

export interface PlanCustomizationEditorProps {
    initialSeatsValues?: ConfiguredMeterValue[];
    pricings: PricingExtended[];
}
