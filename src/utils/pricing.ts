import type {
    ModelType,
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
): Set<ModelType> {
    const categories = scheduleInfo?.pricing_plan_version?.pricing_categories ?? [];

    const pricings = categories.flatMap((category) => [
        ...(category.pricings ?? []),
        ...(category.pricing_groups ?? []).flatMap((group) => group.pricings ?? []),
    ]);

    return new Set(
        pricings
            .flatMap((pricing) => pricing?.items ?? [])
            .flatMap((item) => item.product_items ?? [])
            .map(({ model_type }) => model_type),
    );
}
