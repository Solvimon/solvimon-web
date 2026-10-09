import { ref, type Ref } from 'vue';
import type {
    PricingPlan,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { useLogger } from '@/components/providers';
import { createPricingPlansService } from '@/services/pricingPlans';
import { createSubscriptionsService } from '@/services/subscriptions';
import { isApiError } from '@/services/apiError';
import type {
    PricingPlanChangeDirection,
    PricingPlanGroup,
    PricingPlanGroupChangeType,
    PricingPlanGroupMember,
} from '@/types/pricingPlanGroup';
import { createLatestGuard } from '@/utils/async';

export interface SubscriptionPlanOption {
    pricingPlanId: PricingPlan['id'];
    name: string;
    description?: string;
    /** Where the plan sits in the group, so the options are offered cheapest first. */
    order: number;
    /** The plan the subscription runs on today, which is what the screen opens on. */
    isCurrent: boolean;
    /** Absent on the current plan, since staying put is not a move. */
    direction?: PricingPlanChangeDirection;
    /** How the group times a move to this plan — what the screen promises the customer. */
    changeType?: PricingPlanGroupChangeType;
}

interface UseSubscriptionPlanGroup {
    group: Ref<PricingPlanGroup | undefined>;
    /** The plans that can be moved to, the current one included. Empty when there is no choice. */
    options: Ref<SubscriptionPlanOption[]>;
    currentPricingPlanId: Ref<PricingPlan['id'] | undefined>;
    isPending: Ref<boolean>;
    error: Ref<unknown>;
    load: (args: {
        subscriptionId: PricingPlanSubscription['id'];
        scheduleInfo: PricingPlanScheduleInfoExpanded | undefined;
    }) => Promise<void>;
}

const byOrder = (a: PricingPlanGroupMember, b: PricingPlanGroupMember) => a.order - b.order;

/** A subscription whose plan belongs to no group, which is most of them. */
const isNotGrouped = (error: unknown) => isApiError(error) && error.statusCode === 404;

/**
 * The plans a running subscription may move to: the group its current plan belongs to (MD-4800),
 * resolved into options the customer can pick between (MD-5064).
 *
 * The group answers for the timing of each move rather than the screen, so a transition the
 * merchant has closed off — `NOT_ALLOWED` — is never offered at all.
 *
 * Only the newest load may write the result, so a slow one cannot overwrite a later subscription.
 */
export function useSubscriptionPlanGroup(): UseSubscriptionPlanGroup {
    const { getSubscriptionPricingPlanGroup } = createSubscriptionsService();
    const { getPricingPlan } = createPricingPlansService();
    const logger = useLogger();

    const group = ref<PricingPlanGroup | undefined>();
    const options = ref<SubscriptionPlanOption[]>([]);
    const currentPricingPlanId = ref<PricingPlan['id'] | undefined>();
    const isPending = ref(false);
    const error = ref<unknown>();

    const latestGuard = createLatestGuard();

    const reset = () => {
        group.value = undefined;
        options.value = [];
    };

    /**
     * The plan behind each member, for the name its option is labelled with: the one the response
     * expanded, the one already on the schedule, or — failing both — the plan itself. A plan that
     * cannot be read is dropped rather than failing the others: the remaining moves are still
     * offerable.
     */
    const resolveMemberPlans = async (members: PricingPlanGroupMember[], current: PricingPlan) =>
        Promise.all(
            members.map(async (member) => {
                if (member.pricing_plan) {
                    return { member, plan: member.pricing_plan };
                }

                if (member.pricing_plan_id === current.id) {
                    return { member, plan: current };
                }

                try {
                    return {
                        member,
                        plan: await getPricingPlan({ pricingPlanId: member.pricing_plan_id }),
                    };
                } catch (planError) {
                    logger.warn(
                        'PRICING_PLAN_GROUP_MEMBER_SKIPPED',
                        'Skipped a pricing plan group member that could not be loaded',
                        {},
                        planError,
                    );
                    return undefined;
                }
            }),
        );

    const toOption = ({
        member,
        plan,
        currentMember,
        loadedGroup,
    }: {
        member: PricingPlanGroupMember;
        plan: PricingPlan;
        currentMember: PricingPlanGroupMember;
        loadedGroup: PricingPlanGroup;
    }): SubscriptionPlanOption => {
        const isCurrent = member.pricing_plan_id === currentMember.pricing_plan_id;
        const direction: PricingPlanChangeDirection =
            member.order > currentMember.order ? 'UPGRADE' : 'DOWNGRADE';

        return {
            pricingPlanId: plan.id,
            name: plan.name,
            ...(plan.description && { description: plan.description }),
            order: member.order,
            isCurrent,
            ...(isCurrent
                ? {}
                : {
                      direction,
                      changeType:
                          direction === 'UPGRADE'
                              ? loadedGroup.upgrade_type
                              : loadedGroup.downgrade_type,
                  }),
        };
    };

    const load = async ({
        subscriptionId,
        scheduleInfo,
    }: {
        subscriptionId: PricingPlanSubscription['id'];
        scheduleInfo: PricingPlanScheduleInfoExpanded | undefined;
    }) => {
        const currentPlan = scheduleInfo?.pricing_plan_version?.pricing_plan;

        currentPricingPlanId.value = currentPlan?.id;

        // Nothing to move between until the screen knows which plan it would move from.
        if (!currentPlan) {
            reset();
            return;
        }

        const isLatest = latestGuard();

        isPending.value = true;
        error.value = undefined;

        try {
            const loadedGroup = await getSubscriptionPricingPlanGroup({ id: subscriptionId });

            // Moving between member plans is only open while the group is ACTIVE (MD-4800).
            if (loadedGroup.status !== 'ACTIVE') {
                if (isLatest()) reset();
                return;
            }

            const members = [...(loadedGroup.pricing_plans ?? [])].sort(byOrder);
            const currentMember = members.find(
                ({ pricing_plan_id }) => pricing_plan_id === currentPlan.id,
            );

            // Without the current plan in the group there is no order to move from.
            if (!currentMember) {
                if (isLatest()) reset();
                return;
            }

            const resolved = await resolveMemberPlans(members, currentPlan);

            if (!isLatest()) return;

            group.value = loadedGroup;
            options.value = resolved
                .filter((entry) => entry !== undefined)
                .map(({ member, plan }) => toOption({ member, plan, currentMember, loadedGroup }))
                .filter((option) => option.isCurrent || option.changeType !== 'NOT_ALLOWED');
        } catch (groupError) {
            if (!isLatest()) return;

            reset();

            // A plan outside any group is the ordinary case, not a failure to report.
            if (isNotGrouped(groupError)) {
                return;
            }

            logger.error(
                'PRICING_PLAN_GROUP_LOAD_FAILED',
                'Failed to load the pricing plan group of the subscription',
                {},
                groupError,
            );
            error.value = groupError;
        } finally {
            if (isLatest()) {
                isPending.value = false;
            }
        }
    };

    return { group, options, currentPricingPlanId, isPending, error, load };
}
