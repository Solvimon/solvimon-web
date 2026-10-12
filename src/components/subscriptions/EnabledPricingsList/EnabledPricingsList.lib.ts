import type { PricingExtended, PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import type { EnabledPricingsListEntry } from './EnabledPricingsList.types';
import { getNameFromPricing } from '@/utils/pricing';
import {
    combinePricingPlanVersionWithOverrides,
    getEnabledPricingIdsWithOverrides,
} from '@/utils/pricingPlanScheduleOverrides';

/**
 * The amount and period to show for a pricing. Only the first config of the first item is read:
 * anything with more than one is priced per usage or per tier, which a single line cannot state
 * honestly — those come back without an amount and the row leaves the price out.
 */
function getHeadlinePrice(pricing: PricingExtended) {
    const config = pricing.items?.[0]?.configs?.[0];
    const band = config?.details?.bands?.[0];

    return {
        amount: band?.amount ?? band?.fixed_amount,
        billingPeriod: config?.details?.pricing_period ?? config?.details?.billing_period,
    };
}

/**
 * The pricings currently enabled on a schedule, each resolved against the group it was chosen from.
 *
 * Only grouped pricings are listed: a group is a choice the customer made ("Credit packs" →
 * "1.000 credits"), so it is the only thing there is another option to move to. Pricings sitting
 * directly on a category are part of the plan itself and cannot be swapped.
 *
 * A pricing customized for this subscription is listed as customized, at the price it is billed at.
 */
export function getEnabledPricingsEntries(
    scheduleInfo: PricingPlanScheduleInfoExpanded,
): EnabledPricingsListEntry[] {
    const schedule = scheduleInfo.pricing_plan_schedule;
    const enabledPricingIds = new Set(getEnabledPricingIdsWithOverrides(schedule));

    if (enabledPricingIds.size === 0 || !scheduleInfo.pricing_plan_version) {
        return [];
    }

    const pricingGroups =
        combinePricingPlanVersionWithOverrides({
            pricingPlanVersion: scheduleInfo.pricing_plan_version,
            overridePricings: schedule?.override_pricings,
        }).pricing_categories?.flatMap((category) => category.pricing_groups ?? []) ?? [];

    return pricingGroups.flatMap((group) =>
        (group.pricings ?? [])
            .filter((pricing) => enabledPricingIds.has(pricing.id))
            .map((pricing) => ({
                pricingId: pricing.id,
                pricingGroupId: group.id,
                groupName: group.name,
                // A pricing without a name of its own is only identifiable by the choice it belongs to.
                name: getNameFromPricing(pricing) || group.name,
                ...getHeadlinePrice(pricing),
            })),
    );
}
