import type {
    Amount,
    Customer,
    PaymentMethod,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';

export interface SetDefaultPaymentMethodPayload {
    paymentMethodId: PaymentMethod['id'];
}

export interface ArchivePaymentMethodPayload {
    paymentMethodId: PaymentMethod['id'];
}

export interface GetPaymentMethodsPayload {
    customerId: Customer['id'];
    pagination: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    };
    query?: Record<string, string | number | null | undefined>;
}

interface GetPaymentMethodOptionsBasePayload {
    amount?: Amount;
    country?: string;
}

export interface GetPaymentMethodOptionsByCustomerIdPayload extends GetPaymentMethodOptionsBasePayload {
    customerId: Customer['id'];
    /**
     * Narrows the options to that subscription's payment acceptors. Sent alongside the customer
     * because the portal authorises the lookup through the customer: a portal user has no access to
     * a subscription on its own, so a subscription-only lookup comes back as not found.
     */
    subscriptionId?: PricingPlanSubscription['id'];
}

export interface GetPaymentMethodOptionsBySubscriptionIdPayload extends GetPaymentMethodOptionsBasePayload {
    subscriptionId: PricingPlanSubscription['id'];
    customerId?: never;
}

export type GetPaymentMethodOptionsPayload =
    | GetPaymentMethodOptionsByCustomerIdPayload
    | GetPaymentMethodOptionsBySubscriptionIdPayload;
