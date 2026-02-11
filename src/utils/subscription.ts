import type {
    PricingExtended,
    PricingGroupExtended,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/types';
import { getFirstPricingPlanScheduleOfType } from './pricingPlanSchedule';

/**
 * Recursively searches for PRICING objects with matching IDs.
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
            if (obj.object_type === 'PRICING' && ids.includes(obj.id)) {
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

            result.subscriptionEndDate = new Date(now.getTime() + diff);
        }
    }

    return result;
}
