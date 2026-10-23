import type { Customer } from '@solvimon/solvimon-types';
import type { UseShippingAddresses } from '@/composables/useShippingAddresses';
import type { ShippingAddress } from '@/types/shippingAddress';

export interface ShippingAddressesModalProps {
    showModal: boolean;
    customer: Customer;
    addresses: ShippingAddress[];
    isLoading?: boolean;
    /** What the modal changes the addresses with; each reloads them once it is done. */
    actions: Pick<UseShippingAddresses, 'create' | 'remove' | 'setDefault'>;
}

export interface ShippingAddressesModalEmits {
    (e: 'close'): void;
}
