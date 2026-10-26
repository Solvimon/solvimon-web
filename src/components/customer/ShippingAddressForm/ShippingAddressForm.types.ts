import type { Customer } from '@solvimon/solvimon-types';
import type { ShippingAddress } from '@/types/shippingAddress';

export interface ShippingAddressFormProps {
    /** Who the address is for. Their country, name and email start the form off. */
    customer: Customer;
    /** The stored address being edited. Its fields replace the customer's, and it keeps its reference. */
    address?: ShippingAddress;
    disabled?: boolean;
}
