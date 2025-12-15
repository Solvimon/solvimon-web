export interface CustomerSubscriptionsBlockProps {
    subscriptionIds?: string[];
    hideCtaButtons?: boolean;
}

export interface CustomerSubscriptionsBlockEmits {
    (e: 'view-all', routeName: string): void;
    (e: 'view-details', payload: { subscriptionId: string; routeName: string }): void;
    (e: 'cancel-subscription', payload: { subscriptionId: string; routeName: string }): void;
    (e: 'renew-subscription', payload: { subscriptionId: string; routeName: string }): void;
}
