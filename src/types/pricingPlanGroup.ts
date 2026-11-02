import type { PricingPlan } from '@solvimon/solvimon-types';

/** Local to this package until `@solvimon/solvimon-types` ships the pricing plan group. */
export type PricingPlanGroupChangeType =
    | 'IMMEDIATE'
    | 'IMMEDIATE_PRO_RATA'
    | 'NEXT_BILLING_PERIOD'
    | 'NOT_ALLOWED';

export type PricingPlanGroupStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export interface PricingPlanGroupMember {
    pricing_plan_id: PricingPlan['id'];
    /** A higher order is an upgrade of a lower one. */
    order: number;
    /** Only on an expanded response. */
    pricing_plan?: PricingPlan | null;
}

export interface PricingPlanGroup {
    object_type: 'PRICING_PLAN_GROUP';
    id: string;
    reference: string;
    name?: string | null;
    status: PricingPlanGroupStatus | null;
    upgrade_type: PricingPlanGroupChangeType | null;
    downgrade_type: PricingPlanGroupChangeType | null;
    cancellation_type: PricingPlanGroupChangeType | null;
    pricing_plans?: PricingPlanGroupMember[] | null;
    created_at?: string;
    updated_at?: string;
}

export type PricingPlanChangeDirection = 'UPGRADE' | 'DOWNGRADE';
