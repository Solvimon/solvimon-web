import type { PaymentMethod } from '@solvimon/solvimon-types';

export interface CustomerPaymentMethodsBlockProps {
    paymentMethods: PaymentMethod[];
    showViewAllButton?: boolean;
    /** Labels that button Manage, for a host that manages the methods in place rather than listing them. */
    isManaged?: boolean;
    showAddButton?: boolean;
    /** The gateway offers no method to add, so the block says so instead of offering to add one. */
    hasNoPaymentMethodOptions?: boolean;
    /** How many methods the block leaves out; above zero it links to the rest with this count. */
    morePaymentMethodsCount?: number;
}

export interface CustomerPaymentMethodsBlockEmits {
    (e: 'view-all-payment-methods'): void;
    (e: 'add-payment-method'): void;
}
