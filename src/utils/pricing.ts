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
 * Every model type a schedule prices on, read off the plan rather than off an invoice.
 *
 * An invoice only shows what it charged: a plan billed on usage puts no line on its first invoice
 * at all, so asking the invoice whether anything recurs answers no for a subscription that plainly
 * does. The plan is the only place that question has a stable answer.
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

    // An addon or a group member is only priced once the customer picks it, so counting one they
    // did not would have the plan bill for usage or renew on something they are not buying.
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
