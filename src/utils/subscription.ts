/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pricing, PricingPlanSubscriptionExpanded } from '@solvimon/types';

/**
 * Recursively searches for PRICING objects with matching IDs.
 */
export function findPricingsByIds(
    data: PricingPlanSubscriptionExpanded,
    ids: Pricing['id'][],
): Pricing[] {
    const results: Pricing[] = [];

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
