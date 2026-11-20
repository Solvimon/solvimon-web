import type { Customer, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';

export interface CustomerPaymentAcceptorsProps {
    /**
     * Whose acceptors the block loads. Known before the customer is, so both load at once; left
     * out, the subscription's customer is used.
     */
    customerId?: Customer['id'];
    /**
     * Narrows the block to the acceptors of one self-billing subscription, which Manage then
     * chooses. Without one the block lists all of the customer's acceptors.
     */
    subscription?: PricingPlanSubscriptionExpanded;
    /**
     * How many acceptors the block shows; the rest are counted below them.
     * @default 3
     */
    maxItems?: number;
    /** Set while the screen around it is still loading, so the block waits with it. */
    isLoading?: boolean;
}

export interface CustomerPaymentAcceptorsEmits {
    /** The acceptors chosen for the subscription changed, so the subscription on screen is stale. */
    (e: 'subscription-changed'): void;
}
