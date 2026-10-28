import type { ShippingAddressCreatePayload, ShippingAddressStatus } from '@solvimon/solvimon-types';

export type { ShippingAddress, ShippingAddressStatus } from '@solvimon/solvimon-types';

/**
 * `status` is accepted on create but missing from `ShippingAddressCreatePayload`. Left out, the
 * address is stored as a DRAFT, which is not listed and which the portal cannot activate.
 */
export type CreateShippingAddressPayload = ShippingAddressCreatePayload & {
    status?: ShippingAddressStatus;
};
