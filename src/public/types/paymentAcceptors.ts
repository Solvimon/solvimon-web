export interface PaymentAcceptorsConfiguration {
    /** The number of acceptors shown in the summary. Defaults to 3. */
    maxItems?: number;
    /** Whether the SDK offers inline management. Defaults to `inline` for eligible customers. */
    management?: 'inline' | 'read-only';
}

export interface SubscriptionPaymentAcceptorsConfiguration extends PaymentAcceptorsConfiguration {
    /** The self-billing subscription belonging to the customer authorized by this portal object. */
    subscriptionId: string;
}

/** Whether a subscription uses all current and future active acceptors or a fixed selection. */
export type PaymentAcceptorAssignment =
    | { mode: 'all-active' }
    | { mode: 'selected'; paymentAcceptorIds: readonly [string, ...string[]] };
