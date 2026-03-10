import type { Customer, PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/types';

export type SubscriptionsListConfiguration = {
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
    showCancelButton?: boolean;
    showRenewButton?: boolean;
};

export interface SubscriptionsListProps {
    customer: Customer;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    configuration?: SubscriptionsListConfiguration;
}

export interface SubscriptionsListEmits {
    (e: 'load-more'): void;
}
