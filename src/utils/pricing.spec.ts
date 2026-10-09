import {
    getAllPricingsFromScheduleInfos,
    getModelTypesFromScheduleInfo,
    getNameFromPricing,
    getPricingsFromScheduleInfo,
} from './pricing';
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

    describe('getPricingsFromScheduleInfo', () => {
        const makeInfo = (
            categories: PricingCategoryExtended[] | undefined,
        ): PricingPlanScheduleInfoExpanded =>
            ({
                pricing_plan_version: { pricing_categories: categories },
            }) as unknown as PricingPlanScheduleInfoExpanded;

        it('returns all pricings from categories', () => {
            const info = makeInfo([
                { product_category_id: 'cat-1', pricings: [{ id: 'p1' }, { id: 'p2' }] } as any,
                { product_category_id: 'cat-2', pricings: [{ id: 'p3' }] } as any,
            ]);

            const result = getPricingsFromScheduleInfo(info);

            expect(result).toHaveLength(3);
            expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
        });

        it('returns empty array when pricing_categories is undefined', () => {
            expect(getPricingsFromScheduleInfo(makeInfo(undefined))).toEqual([]);
        });

        it('returns empty array when all categories have no pricings', () => {
            expect(
                getPricingsFromScheduleInfo(
                    makeInfo([{ product_category_id: 'cat-1', pricings: undefined } as any]),
                ),
            ).toEqual([]);
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

describe('getModelTypesFromScheduleInfo', () => {
    const pricing = (id: string, modelType: string, rest: Record<string, unknown> = {}) => ({
        id,
        product_type: 'DEFAULT',
        ...rest,
        items: [{ product_items: [{ model_type: modelType }] }],
    });

    const scheduleInfo = (categories: unknown[]) =>
        ({
            pricing_plan_version: { pricing_categories: categories },
        }) as unknown as PricingPlanScheduleInfoExpanded;

    it('reports what the plan prices on, not what an invoice happened to charge', () => {
        const result = getModelTypesFromScheduleInfo(
            scheduleInfo([
                { pricings: [pricing('pric_1', 'ONE_OFF')] },
                { pricings: [pricing('pric_2', 'USAGE_BASED')] },
            ]),
        );

        expect([...result].sort()).toEqual(['ONE_OFF', 'USAGE_BASED']);
    });

    it('counts everything when no selection is given', () => {
        const result = getModelTypesFromScheduleInfo(
            scheduleInfo([
                {
                    pricings: [pricing('pric_1', 'ONE_OFF')],
                    pricing_groups: [{ pricings: [pricing('pric_2', 'PER_SEAT')] }],
                },
            ]),
        );

        expect(result.has('PER_SEAT')).toBe(true);
    });

    it('leaves out a group pricing the customer has not chosen', () => {
        const info = scheduleInfo([
            {
                pricings: [pricing('pric_1', 'ONE_OFF')],
                pricing_groups: [{ pricings: [pricing('pric_2', 'RECURRING')] }],
            },
        ]);

        expect([...getModelTypesFromScheduleInfo(info, { enabledPricingIds: [] })]).toEqual([
            'ONE_OFF',
        ]);
        expect(
            getModelTypesFromScheduleInfo(info, { enabledPricingIds: ['pric_2'] }).has('RECURRING'),
        ).toBe(true);
    });

    it('leaves out an addon the customer has not chosen', () => {
        const result = getModelTypesFromScheduleInfo(
            scheduleInfo([
                {
                    pricings: [
                        pricing('pric_1', 'ONE_OFF'),
                        pricing('pric_2', 'RECURRING', { product_type: 'ADDON' }),
                    ],
                },
            ]),
            { enabledPricingIds: [] },
        );

        expect([...result]).toEqual(['ONE_OFF']);
    });

    it('keeps a pricing that needs no choosing', () => {
        const result = getModelTypesFromScheduleInfo(
            scheduleInfo([{ pricings: [pricing('pric_1', 'USAGE_BASED')] }]),
            { enabledPricingIds: [] },
        );

        expect([...result]).toEqual(['USAGE_BASED']);
    });

    it('reports nothing for a schedule it cannot read a plan off', () => {
        expect(getModelTypesFromScheduleInfo(undefined).size).toBe(0);
    });
});
