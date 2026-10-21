import type {
    BillingPeriod,
    ConfiguredMeterValue,
    PricingExtended,
} from '@solvimon/solvimon-types';

export interface PricingGroupSeatsOptionProps {
    pricing: PricingExtended;
    /** The seat config the pricing is billed on; without one the option has no stepper. */
    seatConfigId?: string;
    selected: boolean;
    billingPeriod: BillingPeriod;
    /** The order's own count, which the stepper does not go below. */
    defaultValue?: ConfiguredMeterValue;
}
