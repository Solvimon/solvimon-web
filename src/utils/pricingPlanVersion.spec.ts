import { getAllPricingsFromPricingPlanVersion } from './pricingPlanVersion';
import type { PricingExtended, PricingPlanVersionExtended } from '@solvimon/solvimon-types';

const createMockPricing = (id: string): PricingExtended =>
    ({
        id,
        object_type: 'PRICING',
        product_ids: [],
    }) as PricingExtended;

describe('pricingPlanVersion utils', () => {
    describe('getAllPricingsFromPricingPlanVersion', () => {
        it('should return empty array when pricing_categories is undefined', () => {
            const pricingPlanVersion = {} as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([]);
        });

        it('should return empty array when pricing_categories is empty', () => {
            const pricingPlanVersion = {
                pricing_categories: [],
            } as unknown as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([]);
        });

        it('should return pricings from a single category', () => {
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricingPlanVersion = {
                pricing_categories: [{ pricings: [pricing1, pricing2] }],
            } as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([pricing1, pricing2]);
        });

        it('should return flattened pricings from multiple categories', () => {
            const pricing1 = createMockPricing('pricing-1');
            const pricing2 = createMockPricing('pricing-2');
            const pricing3 = createMockPricing('pricing-3');
            const pricingPlanVersion = {
                pricing_categories: [{ pricings: [pricing1] }, { pricings: [pricing2, pricing3] }],
            } as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([pricing1, pricing2, pricing3]);
        });

        it('should handle category with undefined pricings', () => {
            const pricing1 = createMockPricing('pricing-1');
            const pricingPlanVersion = {
                pricing_categories: [{ pricings: undefined }, { pricings: [pricing1] }],
            } as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([pricing1]);
        });

        it('should filter out null values from pricings', () => {
            const pricing1 = createMockPricing('pricing-1');
            const pricingPlanVersion = {
                pricing_categories: [{ pricings: [pricing1, null as unknown as PricingExtended] }],
            } as PricingPlanVersionExtended;

            const result = getAllPricingsFromPricingPlanVersion(pricingPlanVersion);

            expect(result).toEqual([pricing1]);
        });
    });
});
