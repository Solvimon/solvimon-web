import type {
    Amount,
    Customer,
    Invoice,
    PaymentMethod,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import type { CustomerCollectionPayload } from '@/services/requests.types';

export interface SetDefaultPaymentMethodPayload {
    paymentMethodId: PaymentMethod['id'];
}

export interface ArchivePaymentMethodPayload {
    paymentMethodId: PaymentMethod['id'];
}

export type GetPaymentMethodsPayload = CustomerCollectionPayload;

interface GetPaymentMethodOptionsBasePayload {
    amount?: Amount;
    country?: string;
}

export interface GetPaymentMethodOptionsByCustomerIdPayload extends GetPaymentMethodOptionsBasePayload {
    customerId: Customer['id'];
    subscriptionId?: PricingPlanSubscription['id'];
    invoiceId?: Invoice['id'];
}

export interface GetPaymentMethodOptionsBySubscriptionIdPayload extends GetPaymentMethodOptionsBasePayload {
    subscriptionId: PricingPlanSubscription['id'];
    customerId?: never;
    invoiceId?: never;
}

export type GetPaymentMethodOptionsPayload =
    | GetPaymentMethodOptionsByCustomerIdPayload
    | GetPaymentMethodOptionsBySubscriptionIdPayload;
