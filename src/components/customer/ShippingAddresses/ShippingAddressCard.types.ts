import type { ContextMenuOption } from '@solvimon/solvimon-ui';
import type { ShippingAddress } from '@/types/shippingAddress';

export interface ShippingAddressCardProps {
    address: ShippingAddress;
    /** What can be done with the address, behind the menu next to it. Left out, there is no menu. */
    menuItems?: ContextMenuOption[];
    /** Marks the customer's default, which only matters where there is more than one to tell apart. */
    showDefault?: boolean;
    /** Only the address itself, for a summary where who it is for and how to reach them can wait. */
    compact?: boolean;
}
