import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';

export interface OnDemandItemsCardProps {
    items: ChargeOnDemandItem[];
}

export interface OnDemandItemsCardEmits {
    (e: 'order'): void;
}
