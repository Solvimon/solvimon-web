export interface SubscriptionManagementSuccessProps {
    /**
     * The plan the subscription was moved to, when the change was a move within its pricing plan
     * group. Named ahead of the pricing group, since the plan is the larger of the two changes.
     */
    pricingPlanName?: string;
    /**
     * What the subscription now runs on, named after the group it was chosen from — "Credit packs".
     * Left out when the group is not known, in which case the confirmation stays generic.
     */
    pricingGroupName?: string;
}
