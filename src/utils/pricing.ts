import type {
    ModelType,
    Pricing,
    PricingExtended,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';
import { isEmpty } from '@solvimon/solvimon-ui';

export function getPricingsFromScheduleInfo(
    scheduleInfo: PricingPlanScheduleInfoExpanded,
): PricingExtended[] {
    const categories = scheduleInfo.pricing_plan_version.pricing_categories ?? [];

    return categories.flatMap((category) => category.pricings ?? []);
}

export function getAllPricingsFromScheduleInfos(
    scheduleInfos: PricingPlanScheduleInfoExpanded[],
): PricingExtended[] {
    return scheduleInfos.flatMap(getPricingsFromScheduleInfo);
}

export function getNameFromPricing(pricing: PricingExtended): string | undefined {
    return !isEmpty(pricing.name) ? pricing.name : pricing.products?.[0]?.name;
}

/**
 * Read off the plan, not off an invoice: a plan billed on usage puts no line on its first invoice,
 * so the invoice answers "nothing recurs" for a subscription that plainly does.
 */
export function getModelTypesFromScheduleInfo(
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
    { enabledPricingIds }: { enabledPricingIds?: Pricing['id'][] } = {},
): Set<ModelType> {
    const categories = scheduleInfo?.pricing_plan_version?.pricing_categories ?? [];

    const pricings = categories.flatMap((category) => [
        ...(category.pricings ?? []).map((pricing) => ({ pricing, inGroup: false })),
        ...(category.pricing_groups ?? []).flatMap((group) =>
            (group.pricings ?? []).map((pricing) => ({ pricing, inGroup: true })),
        ),
    ]);

    // An addon or group member is priced only once picked, so counting one they left alone would
    // promise usage billing, or a renewal, on something they are not buying.
    const isCharged = ({ pricing, inGroup }: (typeof pricings)[number]) => {
        const isOptional =
            inGroup || !!pricing?.pricing_group_id || pricing?.product_type === 'ADDON';

        return !isOptional || !enabledPricingIds || enabledPricingIds.includes(pricing?.id);
    };

    return new Set(
        pricings
            .filter(isCharged)
            .flatMap(({ pricing }) => pricing?.items ?? [])
            .flatMap((item) => item.product_items ?? [])
            .map(({ model_type }) => model_type),
    );
}
