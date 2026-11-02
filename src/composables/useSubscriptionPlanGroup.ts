import { ref, type Ref } from 'vue';
import type {
    PricingPlan,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscription,
} from '@solvimon/solvimon-types';
import { useLogger } from '@/components/providers';
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
    isCurrent: boolean;
    /** Absent on the current plan, since staying put is not a move. */
    direction?: PricingPlanChangeDirection;
    changeType?: PricingPlanGroupChangeType;
}

interface UseSubscriptionPlanGroup {
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
 * A move the group leaves untimed is as closed as one it marks `NOT_ALLOWED`: the screen could not
 * say when it lands.
 */
const isOffered = (
    changeType: PricingPlanGroupChangeType | null | undefined,
): changeType is PricingPlanGroupChangeType => Boolean(changeType) && changeType !== 'NOT_ALLOWED';

const toOption = (
    member: PricingPlanGroupMember,
    plan: PricingPlan,
    currentMember: PricingPlanGroupMember,
    group: PricingPlanGroup,
): SubscriptionPlanOption | undefined => {
    const base = {
        pricingPlanId: plan.id,
        name: plan.name,
        ...(plan.description && { description: plan.description }),
    };

    if (member.pricing_plan_id === currentMember.pricing_plan_id) {
        return { ...base, isCurrent: true };
    }

    // A plan at the same place in the group is neither an upgrade nor a downgrade of it.
    if (member.order === currentMember.order) return undefined;

    const direction = member.order > currentMember.order ? 'UPGRADE' : 'DOWNGRADE';
    const changeType = direction === 'UPGRADE' ? group.upgrade_type : group.downgrade_type;

    if (!isOffered(changeType)) return undefined;

    return { ...base, isCurrent: false, direction, changeType };
};

/**
 * The plans a running subscription may move to: the members of the group its current plan belongs
 * to, read with their plans expanded. Only the newest load may write the result, so a slow one
 * cannot overwrite a later subscription.
 */
export function useSubscriptionPlanGroup(): UseSubscriptionPlanGroup {
    const { getSubscriptionPricingPlanGroup } = createSubscriptionsService();
    const logger = useLogger();

    const options = ref<SubscriptionPlanOption[]>([]);
    const currentPricingPlanId = ref<PricingPlan['id'] | undefined>();
    const isPending = ref(false);
    const error = ref<unknown>();

    const latestGuard = createLatestGuard();

    const load = async ({
        subscriptionId,
        scheduleInfo,
    }: {
        subscriptionId: PricingPlanSubscription['id'];
        scheduleInfo: PricingPlanScheduleInfoExpanded | undefined;
    }) => {
        const version = scheduleInfo?.pricing_plan_version;
        const currentPlanId = version?.pricing_plan_id ?? version?.pricing_plan?.id;
        const isLatest = latestGuard();

        currentPricingPlanId.value = currentPlanId;
        error.value = undefined;

        if (!currentPlanId) {
            options.value = [];
            isPending.value = false;
            return;
        }

        isPending.value = true;

        try {
            const group = await getSubscriptionPricingPlanGroup({ id: subscriptionId });

            if (!isLatest()) return;

            const members = [...(group.pricing_plans ?? [])].sort(byOrder);
            const currentMember = members.find(
                ({ pricing_plan_id }) => pricing_plan_id === currentPlanId,
            );

            if (group.status !== 'ACTIVE' || !currentMember) {
                options.value = [];
                return;
            }

            options.value = members.flatMap((member) => {
                const plan =
                    member.pricing_plan ??
                    (member === currentMember ? version?.pricing_plan : undefined);
                const option = plan && toOption(member, plan, currentMember, group);

                return option ? [option] : [];
            });
        } catch (groupError) {
            if (!isLatest()) return;

            options.value = [];
            if (isNotGrouped(groupError)) return;

            logger.error(
                'PRICING_PLAN_GROUP_LOAD_FAILED',
                'Failed to load the pricing plan group of the subscription',
                {},
                groupError,
            );
            error.value = groupError;
        } finally {
            if (isLatest()) isPending.value = false;
        }
    };

    return { options, currentPricingPlanId, isPending, error, load };
}
