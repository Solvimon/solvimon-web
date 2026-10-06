import type {
    Customer,
    CustomerWalletBalanceItem,
    Invoice,
    PaymentMethod,
    PricingPlanSchedule,
    PricingPlanScheduleWithPlanData,
} from '@solvimon/solvimon-types';
import type { ChargeOnDemandItem } from '@solvimon/solvimon-ui';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';
import type { BaseScreenProps } from '@/public/screens/types';

export interface SubscriptionDetailsProps extends BaseScreenProps {
    subscription?: PricingPlanSubscriptionExpanded;
    schedulesData?: PricingPlanScheduleWithPlanData[];
    customer?: Customer;
    paymentMethods?: PaymentMethod[];
    walletBalances?: CustomerWalletBalanceItem[];
    /** What the customer can order on the schedule the subscription is billed on now. */
    onDemandItems?: ChargeOnDemandItem[];
    onDemandScheduleId?: PricingPlanSchedule['id'];
    isOnDemandItemsLoading?: boolean;
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
