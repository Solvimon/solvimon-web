import type { Band, BillingPeriod } from '@solvimon/types';

export interface TieredTableRowProps {
    band: Band;
    previousBand?: Band;
    isFirst: boolean;
    period?: BillingPeriod;
}
