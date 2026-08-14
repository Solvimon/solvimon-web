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
    /** Brand logo shown beside the subscription's name, as in the checkout summary. */
    avatar?: string;
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
    /** Brand logo shown beside the subscription's name in the cancellation summary. */
    avatar?: string;
}

export interface SubscriptionDetailsEmits {
    /** A top-up was charged, so the balance it credited is out of date. */
    (e: 'top-up-charged'): void;
    /** A new payment method was tokenized and stored for the customer. */
    (e: 'payment-method-stored'): void;
    /** The subscription was cancelled or renewed, so the copy on screen is out of date. */
    (e: 'subscription-changed'): void;
}
