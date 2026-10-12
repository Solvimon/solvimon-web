import type {
    PricingExtended,
    PricingGroupExtended,
    PricingPlan,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscription,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { getFirstPricingPlanScheduleOfType } from './pricingPlanSchedule';

/**
 * The schedule the subscription runs on now. Schedule infos are in chronological order, so the last
 * one supersedes the ones before it.
 */
export function getMostRecentScheduleInfo(
    subscription: PricingPlanSubscriptionExpanded | undefined,
): PricingPlanScheduleInfoExpanded | undefined {
    return subscription?.pricing_plan_schedule_infos?.at(-1);
}

/** The pricing plan the subscription is on now. */
export function getMostRecentPricingPlan(
    subscription: PricingPlanSubscriptionExpanded | undefined,
): PricingPlan | undefined {
    return getMostRecentScheduleInfo(subscription)?.pricing_plan_version?.pricing_plan;
}

/**
 * The name to show for a subscription: the name it was given, then the plan it is on. Callers pass
 * their own `fallback` because the wording differs per screen — and because translating it belongs
 * in the component, not here.
 */
export function getSubscriptionName({
    subscription,
    fallback,
}: {
    subscription: PricingPlanSubscriptionExpanded | undefined;
    fallback: string;
}): string {
    return subscription?.name || getMostRecentPricingPlan(subscription)?.name || fallback;
}

type InactivePeriod = NonNullable<PricingPlanSubscription['inactive_periods']>[number];

/**
 * The inactive period the API acts on: the earliest one without an `end_at`, optionally of one
 * type. A cancellation is such a period, so one that has an `end_at` is not standing in the way.
 */
export function getOpenInactivePeriod(
    subscription: Pick<PricingPlanSubscription, 'inactive_periods'> | undefined,
    type?: InactivePeriod['type'],
): InactivePeriod | undefined {
    return (subscription?.inactive_periods ?? [])
        .filter((period) => !period.end_at && (!type || period.type === type))
        .reduce<
            InactivePeriod | undefined
        >((earliest, period) => (!earliest || new Date(period.start_at) < new Date(earliest.start_at) ? period : earliest), undefined);
}

/**
 * The cancellation the customer can still undo. The API undoes the earliest open period whatever
 * its type, and only before it starts, so a plan change ahead of the cancellation rules it out.
 */
export function getUndoableCancellation(
    subscription: Pick<PricingPlanSubscription, 'inactive_periods' | 'status'> | undefined,
    now: Date = new Date(),
): InactivePeriod | undefined {
    if (subscription?.status !== 'ACTIVE') return undefined;

    const period = getOpenInactivePeriod(subscription);

    if (period?.type !== 'CANCEL' || new Date(period.start_at) <= now) return undefined;

    return period;
}

/**
 * Recursively searches for PRICING objects with matching IDs, each once: a pricing is repeated in
 * every schedule that offers it.
 */
export function findPricingsByIds(
    data: PricingPlanSubscriptionExpanded,
    ids: PricingExtended['id'][],
): PricingExtended[] {
    const results: PricingExtended[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function recurse(obj: any) {
        if (Array.isArray(obj)) {
            obj.forEach(recurse);
        } else if (obj && typeof obj === 'object') {
            if (
                obj.object_type === 'PRICING' &&
                ids.includes(obj.id) &&
                !results.some(({ id }) => id === obj.id)
            ) {
                results.push(obj);
            }
            Object.values(obj).forEach(recurse);
        }
    }

    recurse(data);

    return results;
}

export function getPricingGroupsFromExtendedPricingPlanSubscription(
    subscription: PricingPlanSubscriptionExpanded,
): PricingGroupExtended[] {
    return subscription.pricing_plan_schedule_infos.flatMap(
        (info) =>
            info.pricing_plan_version.pricing_categories?.flatMap(
                (category) => category.pricing_groups ?? [],
            ) ?? [],
    );
}

type StartAndEndDates = {
    trialStartDate: Date | undefined;
    trialEndDate: Date | undefined;
    subscriptionStartDate: Date | undefined;
    subscriptionEndDate: Date | undefined;
};

/**
 * Get the fallback trial and subscription start and end dates.
 */
export function getFallbackTrialAndSubscriptionStartAndEndDates(
    subscription: PricingPlanSubscriptionExpanded,
): StartAndEndDates {
    const result: StartAndEndDates = {
        trialStartDate: undefined,
        trialEndDate: undefined,
        subscriptionStartDate: undefined,
        subscriptionEndDate: undefined,
    };

    if (!subscription?.pricing_plan_schedule_infos?.length) {
        return result;
    }

    const now = new Date();

    const trialSchedule = getFirstPricingPlanScheduleOfType({
        type: 'TRIAL',
        pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
    });

    if (trialSchedule?.start_at) {
        result.trialStartDate = now;

        if (trialSchedule.end_at) {
            const diff =
                new Date(trialSchedule.end_at).getTime() -
                new Date(trialSchedule.start_at).getTime();

            result.trialEndDate = new Date(now.getTime() + diff);
        }
    }

    const subscriptionSchedule = getFirstPricingPlanScheduleOfType({
        type: 'DEFAULT',
        pricingPlanScheduleInfos: subscription.pricing_plan_schedule_infos,
    });

    if (subscriptionSchedule?.start_at) {
        if (result.trialEndDate) {
            result.subscriptionStartDate = result.trialEndDate;
        } else {
            result.subscriptionStartDate = now;
        }

        if (subscriptionSchedule.end_at) {
            const diff =
                new Date(subscriptionSchedule.end_at).getTime() -
                new Date(subscriptionSchedule.start_at).getTime();

            result.subscriptionEndDate = new Date(result.subscriptionStartDate.getTime() + diff);
        }
    }

    return result;
}
