import type { Pricing, PricingPlanSubscription } from '@solvimon/solvimon-types';

export interface SubscriptionManagementConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    /**
     * The pricing the customer is upgrading from — the one currently enabled on the active
     * schedule. Names the screen after the group it was chosen from. Left out when the host opens
     * the screen without a particular upgrade in mind.
     */
    currentPricingId?: Pricing['id'];
}

export interface SubscriptionManagementProps {
    configuration: SubscriptionManagementConfiguration;
    /** The merchant's emblem, which the entry takes from the branding. */
    avatar?: string;
}
