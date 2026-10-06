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
     * Called when the customer places an on-demand order, once the order modal closes. The order
     * created an invoice whether or not its payment went through, so `paymentStatus` says which:
     * anything but `PAID` is an invoice still to be paid. Use it to refresh an invoice list or to
     * follow up on the order.
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
}
