import type {
    Customer,
    PaymentMethod,
    PaymentMethodOptionsResponse,
} from '@solvimon/solvimon-types';
import type { BaseScreenProps } from '@/public/screens/types';

export interface PaymentMethodsManagementProps extends BaseScreenProps {
    customer: Customer;
    paymentMethods: PaymentMethod[];
    paymentMethodOptions: PaymentMethodOptionsResponse;
}
