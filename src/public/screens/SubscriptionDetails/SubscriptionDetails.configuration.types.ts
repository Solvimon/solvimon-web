import type { PricingPlanSubscription } from '@solvimon/solvimon-types';

export interface SubscriptionDetailsConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    /**
     * Offers "Go to invoice" on the receipt of an on-demand order, and when the payment of a placed
     * order was refused, which sends a `view-invoice` action request. Turn it on only when you handle that action request; otherwise the button
     * would only close the order. Defaults to `false`.
     */
    canViewCreatedInvoice?: boolean;
}
