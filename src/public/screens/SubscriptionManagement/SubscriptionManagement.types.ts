import type { Pricing, PricingPlanSubscription } from '@solvimon/solvimon-types';

export interface SubscriptionManagementConfiguration {
    subscriptionId: PricingPlanSubscription['id'];
    /**
     * The pricing the customer is upgrading from — the one currently enabled on the active
     * schedule. Names the screen after the group it was chosen from. Left out when the host opens
     * the screen without a particular upgrade in mind.
     */
    enabledPricingId?: Pricing['id'];
}

export interface SubscriptionManagementProps {
    configuration: SubscriptionManagementConfiguration;
}
