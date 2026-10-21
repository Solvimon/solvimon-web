import type { ConfiguredMeterValue, Pricing } from '@solvimon/solvimon-types';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';

export interface PricingGroupSeatsEditorProps extends PricingGroupEditorBaseProps {
    seatsValues: ConfiguredMeterValue[];
    seatConfigIdByPricingId: Map<Pricing['id'], string>;
    initialSeatsValues?: ConfiguredMeterValue[];
}
