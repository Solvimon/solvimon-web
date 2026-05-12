import { getAllPricingsFromScheduleInfos, getNameFromPricing } from './pricing';
import type {
    PricingCategoryExtended,
    PricingExtended,
    PricingPlanScheduleInfoExpanded,
} from '@solvimon/solvimon-types';

describe('pricing utils', () => {
    describe('getAllPricingsFromScheduleInfos', () => {
        const createMockPricing = (id: string): PricingExtended =>
            ({
                id,
                object_type: 'PRICING',
                product_ids: [],
            }) as PricingExtended;

        const createMockCategory = (
            id: string,
            pricings?: PricingExtended[],
        ): PricingCategoryExtended =>
            ({
                product_category_id: id,
                pricings,
            }) as PricingCategoryExtended;

        const createMockScheduleInfo = (
            id: string,
            pricingCategories?: PricingCategoryExtended[],
        ): PricingPlanScheduleInfoExpanded => ({
            id,
            start_at: '2024-01-01T00:00:00Z',
            end_at: '2024-12-31T23:59:59Z',
            pricing_plan_version_id: 'version-1',
            type: 'DEFAULT',
            pricing_plan_version: {
                object_type: 'PRICING_PLAN_VERSION',
                id: 'version-1',
                pricing_plan_id: 'plan-1',
                version: 1,
                status: 'ACTIVE',
                pricing_categories: pricingCategories,
                pricing_plan: {
                    object_type: 'PRICING_PLAN',
                    id: 'plan-1',
                    reference: 'plan-ref-1',
                    name: 'Test Plan',
                    type: 'STANDARD',
                },
            } as any,
            pricing_plan_schedule: {
                id,
                type: 'DEFAULT',
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } as any,
        });

        it('should return empty array when scheduleInfos is empty', () => {
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([]);
        });

        it('should return empty array when scheduleInfos have no pricing_categories', () => {
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1'),
                createMockScheduleInfo('schedule-2'),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([]);
        });

        it('should return empty array when pricing_categories have no pricings', () => {
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [
                    createMockCategory('category-1', []),
                    createMockCategory('category-2', []),
                ]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([]);
        });

        it('should return empty array when pricing_categories have undefined pricings', () => {
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [
                    createMockCategory('category-1', undefined),
                    createMockCategory('category-2', undefined),
                ]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([]);
        });

        it('should return all pricings from a single schedule with single category', () => {
            const pricings = [createMockPricing('pricing-1'), createMockPricing('pricing-2')];
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [createMockCategory('category-1', pricings)]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual(pricings);
        });

        it('should return all pricings from a single schedule with multiple categories', () => {
            const pricings1 = [createMockPricing('pricing-1'), createMockPricing('pricing-2')];
            const pricings2 = [createMockPricing('pricing-3')];
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [
                    createMockCategory('category-1', pricings1),
                    createMockCategory('category-2', pricings2),
                ]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([...pricings1, ...pricings2]);
        });

        it('should return all pricings from multiple schedules', () => {
            const pricings1 = [createMockPricing('pricing-1')];
            const pricings2 = [createMockPricing('pricing-2'), createMockPricing('pricing-3')];
            const pricings3 = [createMockPricing('pricing-4')];
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [createMockCategory('category-1', pricings1)]),
                createMockScheduleInfo('schedule-2', [
                    createMockCategory('category-2', pricings2),
                    createMockCategory('category-3', pricings3),
                ]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([...pricings1, ...pricings2, ...pricings3]);
        });

        it('should handle mixed scenarios with some categories having pricings and others not', () => {
            const pricings1 = [createMockPricing('pricing-1')];
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', [
                    createMockCategory('category-1', pricings1),
                    createMockCategory('category-2', []),
                    createMockCategory('category-3', undefined),
                ]),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual(pricings1);
        });

        it('should handle scheduleInfos with undefined pricing_categories', () => {
            const scheduleInfos: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', undefined),
            ];

            const result = getAllPricingsFromScheduleInfos(scheduleInfos);

            expect(result).toEqual([]);
        });
    });

    describe('getNameFromPricing', () => {
        it('returns pricing.name when it is non-empty', () => {
            const pricing = { name: 'Monthly Plan' } as PricingExtended;
            expect(getNameFromPricing(pricing)).toBe('Monthly Plan');
        });

        it('returns the first product name when pricing.name is empty', () => {
            const pricing = {
                name: '',
                products: [{ name: 'Product A' }, { name: 'Product B' }],
            } as unknown as PricingExtended;
            expect(getNameFromPricing(pricing)).toBe('Product A');
        });

        it('returns undefined when both pricing.name is empty and there are no products', () => {
            const pricing = { name: '' } as PricingExtended;
            expect(getNameFromPricing(pricing)).toBeUndefined();
        });

        it('returns undefined when pricing.name is empty and products is an empty array', () => {
            const pricing = { name: '', products: [] } as unknown as PricingExtended;
            expect(getNameFromPricing(pricing)).toBeUndefined();
        });
    });
});
