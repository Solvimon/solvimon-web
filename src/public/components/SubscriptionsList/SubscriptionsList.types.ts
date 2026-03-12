import type { Customer, PaymentMethod, PricingPlanSubscriptionExpanded } from '@solvimon/types';

export type SubscriptionsListConfiguration = {
    maxItems?: number;
    showViewAllButton?: boolean;
    showViewDetailsButton?: boolean;
    showCancelButton?: boolean;
    showRenewButton?: boolean;
};

export interface SubscriptionsListProps {
    customer: Customer | null;
    subscriptions: PricingPlanSubscriptionExpanded[];
    paymentMethods?: PaymentMethod[];
    isLoading: boolean;
    configuration?: SubscriptionsListConfiguration;
}

export interface SubscriptionsListEmits {
    (e: 'load-more'): void;
}
