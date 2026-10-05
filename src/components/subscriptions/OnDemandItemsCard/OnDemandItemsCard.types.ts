import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';

export interface OnDemandItemsCardProps {
    /** The items the customer can order, listed with the price they are offered at. */
    items: ChargeOnDemandItem[];
}

export interface OnDemandItemsCardEmits {
    (e: 'order'): void;
}
