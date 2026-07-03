import type { PaymentMethod } from '@solvimon/solvimon-types';

export interface PaymentMethodsListProps {
    paymentMethods: PaymentMethod[];
}

export interface PaymentMethodsListEmits {
    (e: 'delete', paymentMethod: PaymentMethod): void;
    (e: 'set-default', paymentMethod: PaymentMethod): void;
}
