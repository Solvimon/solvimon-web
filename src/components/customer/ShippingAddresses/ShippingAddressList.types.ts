import type { ContextMenuOption } from '@solvimon/solvimon-ui';
import type { ShippingAddress } from '@/types/shippingAddress';

export interface ShippingAddressListProps {
    addresses: ShippingAddress[];
    /** The menu next to each address. Left out, there is none. */
    getMenuItems?: (address: ShippingAddress) => ContextMenuOption[];
    /** Shows only the address lines; see the card. */
    compact?: boolean;
}
