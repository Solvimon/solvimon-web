import type { Customer, PaymentMethod } from '@solvimon/types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface CustomerSubscriptionsBlockItemProps {
    subscription: PricingPlanSubscriptionExpanded;
    paymentMethod?: PaymentMethod;
    isFirst?: boolean;
    hideCtaButtons?: boolean;
    customer: Customer;
}

export interface CustomerSubscriptionsBlockItemEmits {
    (e: 'view-details', subscriptionId: string): void;
    (e: 'cancel-subscription', subscriptionId: string): void;
    (e: 'renew-subscription', subscriptionId: string): void;
}
