import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export type SubscriptionsListConfiguration = {
    maxItems?: number;
    showViewAllButton?: boolean;
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
