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
    subscriptionId: PricingPlanSubscription['id'];
    avatar?: string;
}

export interface SubscriptionDetailsProps extends BaseScreenProps {
    subscription?: PricingPlanSubscriptionExpanded;
    schedulesData?: PricingPlanScheduleWithPlanData[];
    customer?: Customer;
    paymentMethods?: PaymentMethod[];
    walletBalances?: CustomerWalletBalanceItem[];
    hasWalletBalancesError?: boolean;
    avatar?: string;
}

export interface SubscriptionDetailsEmits {
    (e: 'top-up-charged'): void;
    (e: 'auto-top-up-saved'): void;
    (e: 'auto-top-up-cancelled'): void;
    (e: 'payment-method-stored'): void;
    (e: 'subscription-changed'): void;
}
