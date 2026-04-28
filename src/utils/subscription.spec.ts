import type { PricingPlanSubscriptionExpanded } from '@solvimon/solvimon-types';
import { findPricingsByIds } from './subscription';

describe('subscription utils', () => {
    describe('findPricingsByIds', () => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const mockData = {
            pricing_plan_schedule_infos: [
                {
                    pricing_plan_version: {
                        pricing_categories: [
                            {
                                pricing_groups: [
                                    {
                                        object_type: 'PRICING_GROUP',
                                        id: 'prig_AwD1Lk0uXII7V1CauQ1u',
                                        pricings: [
                                            {
                                                object_type: 'PRICING',
                                                id: 'pric_FwD1Lk0uXII7V2CWub1v',
                                                name: 'Monthly Plan',
                                            },
                                            {
                                                object_type: 'PRICING',
                                                id: 'pric_KwD1Lj0uXIIrlcCXuL1g',
                                                name: 'Annual Plan',
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            ],
        } as PricingPlanSubscriptionExpanded;

        it('returns a pricing when the id matches', () => {
            const result = findPricingsByIds(mockData, ['pric_FwD1Lk0uXII7V2CWub1v']);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('pric_FwD1Lk0uXII7V2CWub1v');
        });

        it('returns multiple pricings when multiple ids match', () => {
            const result = findPricingsByIds(mockData, [
                'pric_FwD1Lk0uXII7V2CWub1v',
                'pric_KwD1Lj0uXIIrlcCXuL1g',
            ]);
            expect(result).toHaveLength(2);
            expect(result.map((p) => p.id)).toContain('pric_FwD1Lk0uXII7V2CWub1v');
            expect(result.map((p) => p.id)).toContain('pric_KwD1Lj0uXIIrlcCXuL1g');
        });

        it('returns empty array when no ids match', () => {
            const result = findPricingsByIds(mockData, ['pric_nonexistent']);
            expect(result).toEqual([]);
        });

        it('handles empty ids array', () => {
            const result = findPricingsByIds(mockData, []);
            expect(result).toEqual([]);
        });
    });
});
