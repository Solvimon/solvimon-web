import type { Amount, ConfiguredMeterValue } from '@solvimon/solvimon-types';

/**
 * Fields MD-5439 adds to the portal-facing contract, mirroring `seats_values` /
 * `default_seats_value`. Removable once `@solvimon/solvimon-types` ships them natively.
 */
declare module '@solvimon/solvimon-types' {
    interface PricingItemConfig {
        default_units?: {
            amount?: Amount;
            number?: string;
        };
    }

    interface PricingPlanSchedule {
        units?: ConfiguredMeterValue[] | null;
    }
}
