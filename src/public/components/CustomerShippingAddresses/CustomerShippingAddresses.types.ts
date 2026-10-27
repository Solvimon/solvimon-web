import type { Customer } from '@solvimon/solvimon-types';

export interface CustomerShippingAddressesProps {
    /**
     * Whose addresses the block loads. Known before the customer is, so both load at once; left
     * out, the customer's own id is used once it arrives.
     */
    customerId?: Customer['id'];
    /** Who the addresses are for, which the forms start on. Without one the block is left out. */
    customer?: Customer;
    /** Set while the screen around it is still loading, so the block waits with it. */
    isLoading?: boolean;
}
