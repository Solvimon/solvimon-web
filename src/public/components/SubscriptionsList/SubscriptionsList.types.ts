import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export type SubscriptionsListConfiguration = {
    /**
     * Whether to show the "View all" button, which sends a `view-all-subscriptions` action request.
     * @default true
     */
    showViewAllButton?: boolean;
    /**
     * Whether to show each subscription's details button, which sends a `view-subscription-details` action
     * request.
     * @default true
     */
    showViewDetailsButton?: boolean;
    showManageButton?: boolean;
};

export interface SubscriptionsListProps {
    customer: Customer | undefined;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    hasError?: boolean;
    hasMoreItems?: boolean;
    isLoadingMore?: boolean;
    configuration?: SubscriptionsListConfiguration;
}

export interface SubscriptionsListEmits {
    (e: 'load-more'): void;
}
