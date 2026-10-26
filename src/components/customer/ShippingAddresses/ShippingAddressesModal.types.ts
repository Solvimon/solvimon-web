import type { Customer } from '@solvimon/solvimon-types';
import type { UseShippingAddresses } from '@/composables/useShippingAddresses';
import type { ShippingAddress } from '@/types/shippingAddress';

/**
 * Where the modal opens. Opened on one address's edit or delete, it closes once that is done
 * rather than going on to the list.
 */
export type ShippingAddressesModalStart =
    | { step: 'LIST' | 'ADD' }
    | { step: 'EDIT' | 'DELETE'; address: ShippingAddress };

export interface ShippingAddressesModalProps {
    showModal: boolean;
    customer: Customer;
    addresses: ShippingAddress[];
    isLoading?: boolean;
    /** @default { step: 'LIST' } */
    start?: ShippingAddressesModalStart;
    /** What the modal changes the addresses with; each reloads them once it is done. */
    actions: Pick<UseShippingAddresses, 'create' | 'replace' | 'remove'>;
}

export interface ShippingAddressesModalEmits {
    (e: 'close'): void;
}
