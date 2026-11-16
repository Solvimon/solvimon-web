import type { PaymentMethod } from '@solvimon/solvimon-types';

export interface PaymentMethodsListProps {
    paymentMethods: PaymentMethod[];
    /** Leaves out each card's menu, for a summary whose methods are managed elsewhere. */
    hideOptions?: boolean;
}

export interface PaymentMethodsListEmits {
    (e: 'delete', paymentMethod: PaymentMethod): void;
    (e: 'set-default', paymentMethod: PaymentMethod): void;
}
