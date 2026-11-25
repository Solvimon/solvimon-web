import type { Customer, PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export interface CustomerPaymentAcceptorsProps extends PaymentAcceptorsConfiguration {
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
    /** Set while the screen around it is still loading, so the block waits with it. */
    isLoading?: boolean;
}
