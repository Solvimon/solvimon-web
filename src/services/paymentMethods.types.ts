import type { Amount, Customer, PricingPlanSubscription } from '@solvimon/types';

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
    subscriptionId?: never;
}

export interface GetPaymentMethodOptionsBySubscriptionIdPayload extends GetPaymentMethodOptionsBasePayload {
    subscriptionId: PricingPlanSubscription['id'];
    customerId?: never;
}

export type GetPaymentMethodOptionsPayload =
    | GetPaymentMethodOptionsByCustomerIdPayload
    | GetPaymentMethodOptionsBySubscriptionIdPayload;
