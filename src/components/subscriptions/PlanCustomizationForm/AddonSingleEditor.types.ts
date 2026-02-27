import type { PricingGroupExtended } from '@solvimon/types';
import type { PricingGroupEditorBaseProps } from './PricingGroupEditorBase.types';

export interface AddonSingleEditorProps extends PricingGroupEditorBaseProps {
    constraint: PricingGroupExtended['selection_constraint'];
}
