import type { Customer, PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/types';

export interface SubscriptionsListProps {
    customer: Customer;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
    showCancelButton?: boolean;
    showRenewButton?: boolean;
}

export interface SubscriptionsListEmits {
    (e: 'view-subscription-details', payload: { subscriptionId: string }): void;
    (e: 'view-all-subscriptions'): void;
    (e: 'cancel-subscription', payload: { subscriptionId: string }): void;
    (e: 'renew-subscription', payload: { subscriptionId: string }): void;
    (e: 'load-more'): void;
}
