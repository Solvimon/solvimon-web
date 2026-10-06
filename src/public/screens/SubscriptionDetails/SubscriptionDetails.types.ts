import type {
    Customer,
    CustomerWalletBalanceItem,
    Invoice,
    PaymentMethod,
    PricingPlanSchedule,
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { BaseScreenProps } from '@/public/screens/types';

export interface SubscriptionDetailsConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    avatar?: string;
    /**
     * Called as soon as an on-demand order creates an invoice, while the customer still sees its
     * receipt. The order created an invoice whether or not its payment went through, so
     * `paymentStatus` says which: `PAID` and `OVERPAID` are settled, while `UNPAID`,
     * `PARTIALLY_PAID` and a missing status are an invoice still to be paid. Use it to refresh an
     * invoice list or to follow up on the order.
     *
     * An order whose outcome is unknown — no response, or a failed payment that may or may not have
     * left an invoice — is not reported here. It reaches `onLog` as `ON_DEMAND_CHARGE_FAILED` or
     * `ON_DEMAND_CHARGE_REFUSED`, and the customer is sent to their invoice list.
     */
    onInvoiceCreated?: (invoice: {
        invoiceId: Invoice['id'];
        paymentStatus: Invoice['payment_status'];
    }) => void;
}

export interface SubscriptionDetailsProps extends BaseScreenProps {
    subscription?: PricingPlanSubscriptionExpanded;
    schedulesData?: PricingPlanScheduleWithPlanData[];
    customer?: Customer;
    paymentMethods?: PaymentMethod[];
    walletBalances?: CustomerWalletBalanceItem[];
    /** What the customer can order on the schedule the subscription is billed on now. */
    onDemandItems?: ChargeOnDemandItem[];
    onDemandScheduleId?: PricingPlanSchedule['id'];
    hasWalletBalancesError?: boolean;
    avatar?: string;
}

export interface SubscriptionDetailsEmits {
    (e: 'top-up-charged'): void;
    (e: 'auto-top-up-saved'): void;
    (e: 'auto-top-up-cancelled'): void;
    (e: 'payment-method-stored'): void;
    (e: 'subscription-changed'): void;
    /** An on-demand order placed an invoice, paid or not. */
    (e: 'invoice-created', invoice: Invoice): void;
    /** The customer left the receipt of a paid on-demand order, which may have granted credits. */
    (e: 'on-demand-order-paid'): void;
}
