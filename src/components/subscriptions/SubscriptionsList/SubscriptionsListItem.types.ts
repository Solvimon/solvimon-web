import type {
    Customer,
    PaymentMethod,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';

export interface SubscriptionsListItemProps {
    subscription: PricingPlanSubscriptionExpanded;
    paymentMethod?: PaymentMethod;
    customer: Customer;
    showViewSubscriptionDetailsButton?: boolean;
    showManageButton?: boolean;
}

export interface SubscriptionsListItemEmits {
    (e: 'view-subscription-details', payload: { subscriptionId: string }): void;
}
