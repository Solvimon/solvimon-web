import type { Customer } from '@solvimon/solvimon-types';
import type { ShippingAddressDetails } from '@/components/payments/PaymentIntegrationForm/PaymentIntegrationForm.types';

/** Not in `@solvimon/solvimon-types` yet. */
export type ShippingAddressStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

/** A shipping address stored for a customer, as `/portal/shipping-addresses` returns it. */
export interface ShippingAddress extends ShippingAddressDetails {
    object_type?: 'SHIPPING_ADDRESS';
    id: string;
    customer_id: Customer['id'];
    status: ShippingAddressStatus;
    /** One per customer, and only an ACTIVE address can be it. */
    is_default: boolean;
    description?: string;
    created_at?: string;
    updated_at?: string;
}

export type CreateShippingAddressPayload = ShippingAddressDetails & {
    customer_id: Customer['id'];
    /** Left out, the address is stored as a DRAFT, which is not listed and cannot be the default. */
    status?: ShippingAddressStatus;
};
