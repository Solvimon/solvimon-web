import type { Band, BillingPeriod } from '@solvimon/solvimon-types';

export interface TieredTableProps {
    bands: Band[];
    period?: BillingPeriod;
}
