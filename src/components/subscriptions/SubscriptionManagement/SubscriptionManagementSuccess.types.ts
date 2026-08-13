export interface SubscriptionManagementSuccessProps {
    /**
     * What the subscription now runs on, named after the group it was chosen from — "Credit packs".
     * Left out when the group is not known, in which case the confirmation stays generic.
     */
    pricingGroupName?: string;
}
