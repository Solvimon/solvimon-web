import type { ShippingAddress } from '@solvimon/solvimon-types';

export interface ShippingAddressFormConfiguration {
    /** The stored address to edit. Left out, the form adds a new one. */
    shippingAddressId?: ShippingAddress['id'];
}
