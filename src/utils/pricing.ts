import type {
    ModelType,
    Pricing,
    PricingCategoryExtended,
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
 * The pricings a plan charges for. An addon or group member is priced only once picked, so counting
 * one they left alone would promise usage billing, or a renewal, on something they are not buying.
 */
export function getChargedPricings(
    categories: PricingCategoryExtended[] | undefined,
    { enabledPricingIds }: { enabledPricingIds?: Pricing['id'][] } = {},
): { category: PricingCategoryExtended; pricing: PricingExtended }[] {
    const pricings = (categories ?? []).flatMap((category) => [
        ...(category.pricings ?? []).map((pricing) => ({ category, pricing, inGroup: false })),
        ...(category.pricing_groups ?? []).flatMap((group) =>
            (group.pricings ?? []).map((pricing) => ({ category, pricing, inGroup: true })),
        ),
    ]);

    const seenIds = new Set<Pricing['id']>();

    return pricings
        .filter(({ pricing, inGroup }) => {
            if (pricing?.id) {
                if (seenIds.has(pricing.id)) return false;
                seenIds.add(pricing.id);
            }

            const isOptional =
                inGroup || !!pricing?.pricing_group_id || pricing?.product_type === 'ADDON';
            // A customized pricing takes the override's id; the schedule enables it by the original's.
            const isEnabled = [pricing?.id, pricing?.original_pricing_id].some(
                (id) => !!id && !!enabledPricingIds?.includes(id),
            );

            return !isOptional || !enabledPricingIds || isEnabled;
        })
        .map(({ category, pricing }) => ({ category, pricing }));
}

/**
 * Read off the plan, not off an invoice: a plan billed on usage puts no line on its first invoice,
 * so the invoice answers "nothing recurs" for a subscription that plainly does.
 */
export function getModelTypesFromScheduleInfo(
    scheduleInfo: PricingPlanScheduleInfoExpanded | undefined,
    options: { enabledPricingIds?: Pricing['id'][] } = {},
): Set<ModelType> {
    return new Set(
        getChargedPricings(scheduleInfo?.pricing_plan_version?.pricing_categories, options)
            .flatMap(({ pricing }) => pricing?.items ?? [])
            .flatMap((item) => item.product_items ?? [])
            .map(({ model_type }) => model_type),
    );
}
