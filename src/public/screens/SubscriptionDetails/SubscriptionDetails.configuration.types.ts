import type { PricingPlanSubscription } from '@solvimon/solvimon-types';
import type { PaymentAcceptorsConfiguration } from '@/public/types/paymentAcceptors';

export interface SubscriptionDetailsConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    /**
     * Offers "Go to invoice" on the receipt of an on-demand order, and when the payment of a placed
     * order was refused, which sends a `view-invoice` action request. Turn it on only when you handle that action request; otherwise the button
     * would only close the order. Defaults to `false`.
     */
    showViewInvoiceButton?: boolean;
    /** Options for self-billing payment acceptors. Set to false to hide the block and skip its requests. */
    paymentAcceptors?: false | PaymentAcceptorsConfiguration;
}
