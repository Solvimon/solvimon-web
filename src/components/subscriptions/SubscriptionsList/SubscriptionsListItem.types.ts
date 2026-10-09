import type { Customer, PaymentMethod } from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

export interface SubscriptionsListItemProps {
    subscription: PricingPlanSubscriptionExpanded;
    paymentMethod?: PaymentMethod;
    customer: Customer;
    showViewSubscriptionDetailsButton?: boolean;
    showUpgradeButton?: boolean;
    showCancelButton?: boolean;
}

export interface SubscriptionsListItemEmits {
    (e: 'view-subscription-details', payload: { subscriptionId: string }): void;
    (e: 'subscription-changed'): void;
}
