import type {
    Amount,
    Customer,
    Invoice,
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
    subscriptionId?: PricingPlanSubscription['id'];
    /**
     * Narrows the acceptors to the ones the invoice can be paid through. Without it the answer
     * carries every acceptor the customer has, including ones the invoice refuses (DD-3533).
     */
    invoiceId?: Invoice['id'];
}

export interface GetPaymentMethodOptionsBySubscriptionIdPayload extends GetPaymentMethodOptionsBasePayload {
    subscriptionId: PricingPlanSubscription['id'];
    customerId?: never;
    /** The subscription is the scope; an invoice narrows the customer lookup instead. */
    invoiceId?: never;
}

export type GetPaymentMethodOptionsPayload =
    | GetPaymentMethodOptionsByCustomerIdPayload
    | GetPaymentMethodOptionsBySubscriptionIdPayload;
