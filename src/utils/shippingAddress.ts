import type { Address, ShippingAddressAddress } from '@solvimon/solvimon-types';

/** A shipping address's lines as an `Address`, which leaves out what the API sends as null. */
export const toAddress = ({
    line1,
    line2,
    city,
    postal_code,
    state,
    country,
}: ShippingAddressAddress): Address => ({
    line1: line1 ?? undefined,
    line2: line2 ?? undefined,
    city: city ?? undefined,
    postal_code: postal_code ?? undefined,
    state: state ?? undefined,
    country,
});
