import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export interface SubscriptionsListProps {
    customer: Customer;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
    showUpgradeButton?: boolean;
    showCancelButton?: boolean;
}

export interface SubscriptionsListEmits {
    (e: 'view-subscription-details', payload: { subscriptionId: string }): void;
    (e: 'view-all-subscriptions'): void;
    (e: 'subscription-changed'): void;
    (e: 'load-more'): void;
}
