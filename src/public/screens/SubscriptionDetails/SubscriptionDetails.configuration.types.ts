import type { Invoice, PricingPlanSubscription } from '@solvimon/solvimon-types';

/**
 * Reached from the published declarations, so it must import nothing a consumer cannot resolve —
 * `@solvimon/solvimon-ui` included. See docs/development/public-types.md.
 */
export interface SubscriptionDetailsConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    avatar?: string;
    /**
     * Offers "Go to invoice" on the receipt of an on-demand order, which sends a `view-invoice`
     * action request. Turn it on only when you handle that action request; otherwise the button
     * would only close the order. Defaults to `false`.
     */
    canViewCreatedInvoice?: boolean;
    /**
     * Called as soon as an on-demand order creates an invoice, while the customer still sees its
     * receipt. The order created an invoice whether or not its payment went through, so
     * `paymentStatus` says which: `PAID` and `OVERPAID` are settled, while `UNPAID`,
     * `PARTIALLY_PAID` and a missing status are an invoice still to be paid. Use it to refresh an
     * invoice list or to follow up on the order.
     *
     * An order that fails is not reported here, even when it may have left an invoice behind: a
     * payment that could not be made reaches `onLog` as `ON_DEMAND_CHARGE_REFUSED`, and a failure
     * whose outcome is unknown as `ON_DEMAND_CHARGE_FAILED`. Either way the customer is sent to
     * their invoice list.
     */
    onInvoiceCreated?: (invoice: {
        invoiceId: Invoice['id'];
        paymentStatus: Invoice['payment_status'];
    }) => void;
}
