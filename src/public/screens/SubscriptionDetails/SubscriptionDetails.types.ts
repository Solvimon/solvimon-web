import type {
    Customer,
    CustomerWalletBalanceItem,
    PaymentMethod,
    PricingPlanScheduleWithPlanData,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { BaseScreenProps } from '@/public/screens/types';

export interface SubscriptionDetailsConfiguration {
    /**
     * The subscription to show. Matches the id the `view-subscription-details` action carries, so
     * the host can hand it straight through.
     */
    subscriptionId: PricingPlanSubscription['id'];
}

export interface SubscriptionDetailsProps extends BaseScreenProps {
    /**
     * The subscription to show. Absent while it is still loading or when loading failed.
     */
    subscription?: PricingPlanSubscriptionExpanded;
    /**
     * The subscription's pricing plan schedules, rendered as the main content.
     */
    schedulesData?: PricingPlanScheduleWithPlanData[];
    /** The wallet owner, needed to charge a top-up. */
    customer?: Customer;
    /** The customer's stored payment methods, to pay a top-up with. */
    paymentMethods?: PaymentMethod[];
    /** The customer's wallet balances, shown alongside the subscription. */
    walletBalances?: CustomerWalletBalanceItem[];
    /** Whether loading the wallet balances failed. */
    hasWalletBalancesError?: boolean;
}

export interface SubscriptionDetailsEmits {
    /** A top-up was charged, so the balance it credited is out of date. */
    (e: 'top-up-charged'): void;
    /** A new payment method was tokenized and stored for the customer. */
    (e: 'payment-method-stored'): void;
}
