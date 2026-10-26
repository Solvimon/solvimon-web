import type { Customer } from '@solvimon/solvimon-types';
import type { ShippingAddress } from '@/types/shippingAddress';

export interface ShippingAddressFormProps {
    /** Who the address is for. Their country, name and email start the form off. */
    customer: Customer;
    /** The stored address being edited, whose fields the form starts on instead of the customer's. */
    address?: ShippingAddress;
    disabled?: boolean;
}
