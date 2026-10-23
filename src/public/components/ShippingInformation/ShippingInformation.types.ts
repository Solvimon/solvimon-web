import type { Customer } from '@solvimon/solvimon-types';

export interface ShippingInformationProps {
    /** Whose addresses the block shows. It loads them itself once there is a customer. */
    customer?: Customer;
    /** Set while the screen around it is still loading, so the block waits with it. */
    isLoading?: boolean;
}
