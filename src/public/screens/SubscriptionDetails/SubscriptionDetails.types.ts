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
    onDemandItems?: ChargeOnDemandItem[];
    onDemandScheduleId?: PricingPlanSchedule['id'];
    hasWalletBalancesError?: boolean;
    avatar?: string;
    canViewCreatedInvoice?: boolean;
}

export interface SubscriptionDetailsEmits {
    (e: 'top-up-charged'): void;
    (e: 'auto-top-up-saved'): void;
    (e: 'auto-top-up-cancelled'): void;
    (e: 'payment-method-stored'): void;
    (e: 'subscription-changed'): void;
    (e: 'invoice-created', invoice: Invoice): void;
}
