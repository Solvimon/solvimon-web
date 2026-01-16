import type { Band, BillingPeriod } from '@solvimon/types';

export interface TieredTableProps {
    bands: Band[];
    period?: BillingPeriod;
}
