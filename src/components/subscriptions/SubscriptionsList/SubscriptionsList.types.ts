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
    /** The subscriptions could not be loaded, so an empty list says nothing about them. */
    hasError?: boolean;
    hasMoreItems?: boolean;
    isLoadingMore?: boolean;
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
}

export interface SubscriptionsListEmits {
    (e: 'view-subscription-details', payload: { subscriptionId: string }): void;
    (e: 'view-all-subscriptions'): void;
    (e: 'load-more'): void;
}
