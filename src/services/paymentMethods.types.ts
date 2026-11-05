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
    portalUrlId?: never;
}

export interface GetPaymentMethodOptionsBySubscriptionIdPayload extends GetPaymentMethodOptionsBasePayload {
    subscriptionId: PricingPlanSubscription['id'];
    customerId?: never;
    invoiceId?: never;
    portalUrlId?: never;
}

/** A checkout session decides the country, the amount and the payer, and refuses them sent along. */
export interface GetPaymentMethodOptionsByPortalUrlIdPayload {
    portalUrlId: string;
    customerId?: never;
    subscriptionId?: never;
    invoiceId?: never;
    amount?: never;
    country?: never;
}

export type GetPaymentMethodOptionsPayload =
    | GetPaymentMethodOptionsByCustomerIdPayload
    | GetPaymentMethodOptionsBySubscriptionIdPayload
    | GetPaymentMethodOptionsByPortalUrlIdPayload;
