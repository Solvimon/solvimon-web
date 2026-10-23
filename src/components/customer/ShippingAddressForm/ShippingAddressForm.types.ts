import type { Customer } from '@solvimon/solvimon-types';

export interface ShippingAddressFormProps {
    /** Who the address is for. Their country, name and email start the form off. */
    customer: Customer;
    disabled?: boolean;
}
