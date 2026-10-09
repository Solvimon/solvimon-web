import type { PricingPlan } from '@solvimon/solvimon-types';

/**
 * The `PricingPlanGroup` resource (MD-4800): the plans a subscription may move between, plus the
 * rules for when such a move takes effect. Local to this package until
 * `@solvimon/solvimon-types` ships it.
 */
export type PricingPlanGroupChangeType =
    | 'IMMEDIATE'
    | 'IMMEDIATE_PRO_RATA'
    | 'NEXT_BILLING_PERIOD'
    | 'NOT_ALLOWED';

export type PricingPlanGroupStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export interface PricingPlanGroupMember {
    pricing_plan_id: PricingPlan['id'];
    /** Where the plan sits in the group. A higher order is an upgrade of a lower one. */
    order: number;
    /** Only on an expanded response; the plan is fetched by id when it is absent. */
    pricing_plan?: PricingPlan;
}

export interface PricingPlanGroup {
    object_type: 'PRICING_PLAN_GROUP';
    id: string;
    reference: string;
    name?: string;
    /** Moving between member plans is only offered while the group is `ACTIVE`. */
    status: PricingPlanGroupStatus;
    upgrade_type: PricingPlanGroupChangeType;
    downgrade_type: PricingPlanGroupChangeType;
    cancellation_type: PricingPlanGroupChangeType;
    pricing_plans?: PricingPlanGroupMember[];
    created_at?: string;
    updated_at?: string;
}

/** Which way a move between two member plans goes, read off their order within the group. */
export type PricingPlanChangeDirection = 'UPGRADE' | 'DOWNGRADE';
