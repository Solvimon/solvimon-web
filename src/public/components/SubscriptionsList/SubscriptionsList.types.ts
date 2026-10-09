import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export type SubscriptionsListConfiguration = {
    maxItems?: number;
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
    showUpgradeButton?: boolean;
    showCancelButton?: boolean;
};

export interface SubscriptionsListProps {
    customer: Customer | undefined;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    configuration?: SubscriptionsListConfiguration;
}

export interface SubscriptionsListEmits {
    (e: 'load-more'): void;
    (e: 'subscription-changed'): void;
}
