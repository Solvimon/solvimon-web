import type {
    PricingGroupExtended,
    PricingPlanScheduleInfoExpanded,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import {
    findPricingsByIds,
    getFallbackTrialAndSubscriptionStartAndEndDates,
    getMostRecentPricingPlan,
    getPricingGroupsFromExtendedPricingPlanSubscription,
    getSubscriptionName,
} from './subscription';

const makeScheduleInfo = (
    type: 'DEFAULT' | 'TRIAL',
    start_at: string,
    end_at?: string,
): PricingPlanScheduleInfoExpanded =>
    ({
        id: `schedule-${type.toLowerCase()}`,
        type,
        start_at,
        end_at,
        pricing_plan_version_id: 'version-1',
        pricing_plan_version: {} as any,
        pricing_plan_schedule: { id: `schedule-${type.toLowerCase()}`, type, start_at, end_at },
    }) as unknown as PricingPlanScheduleInfoExpanded;

describe('subscription utils', () => {
    describe('getPricingGroupsFromExtendedPricingPlanSubscription', () => {
        it('returns all pricing groups from all schedule infos', () => {
            const subscription = {
                pricing_plan_schedule_infos: [
                    {
                        pricing_plan_version: {
                            pricing_categories: [
                                { pricing_groups: [{ id: 'g1' }, { id: 'g2' }] },
                                { pricing_groups: [{ id: 'g3' }] },
                            ],
                        },
                    },
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getPricingGroupsFromExtendedPricingPlanSubscription(subscription);

            expect(result).toHaveLength(3);
            expect(result.map((g) => g.id)).toEqual(['g1', 'g2', 'g3']);
        });

        it('returns empty array when there are no schedule infos', () => {
            const subscription = {
                pricing_plan_schedule_infos: [],
            } as unknown as PricingPlanSubscriptionExpanded;

            expect(getPricingGroupsFromExtendedPricingPlanSubscription(subscription)).toEqual([]);
        });

        it('returns empty array when pricing_categories is undefined', () => {
            const subscription = {
                pricing_plan_schedule_infos: [
                    { pricing_plan_version: { pricing_categories: undefined } },
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            expect(getPricingGroupsFromExtendedPricingPlanSubscription(subscription)).toEqual([]);
        });

        it('returns empty array when pricing_groups is undefined', () => {
            const subscription = {
                pricing_plan_schedule_infos: [
                    {
                        pricing_plan_version: {
                            pricing_categories: [{ pricing_groups: undefined }],
                        },
                    },
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            expect(getPricingGroupsFromExtendedPricingPlanSubscription(subscription)).toEqual([]);
        });
    });

    describe('getFallbackTrialAndSubscriptionStartAndEndDates', () => {
        const now = new Date('2024-06-01T00:00:00Z');

        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(now);
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('returns all undefined when pricing_plan_schedule_infos is empty', () => {
            const subscription = {
                pricing_plan_schedule_infos: [],
            } as unknown as PricingPlanSubscriptionExpanded;

            expect(getFallbackTrialAndSubscriptionStartAndEndDates(subscription)).toEqual({
                trialStartDate: undefined,
                trialEndDate: undefined,
                subscriptionStartDate: undefined,
                subscriptionEndDate: undefined,
            });
        });

        it('sets trialStartDate to now when trial schedule exists but has no end_at', () => {
            const subscription = {
                pricing_plan_schedule_infos: [makeScheduleInfo('TRIAL', '2024-01-01T00:00:00Z')],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getFallbackTrialAndSubscriptionStartAndEndDates(subscription);

            expect(result.trialStartDate).toEqual(now);
            expect(result.trialEndDate).toBeUndefined();
        });

        it('computes trialEndDate by projecting the trial duration from now', () => {
            const trialStart = '2024-01-01T00:00:00Z';
            const trialEnd = '2024-01-31T00:00:00Z'; // 30 days
            const subscription = {
                pricing_plan_schedule_infos: [
                    makeScheduleInfo('TRIAL', trialStart, trialEnd),
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getFallbackTrialAndSubscriptionStartAndEndDates(subscription);

            const diff = new Date(trialEnd).getTime() - new Date(trialStart).getTime();
            expect(result.trialStartDate).toEqual(now);
            expect(result.trialEndDate).toEqual(new Date(now.getTime() + diff));
        });

        it('sets subscriptionStartDate to now when no trial exists', () => {
            const subscription = {
                pricing_plan_schedule_infos: [
                    makeScheduleInfo('DEFAULT', '2024-02-01T00:00:00Z'),
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getFallbackTrialAndSubscriptionStartAndEndDates(subscription);

            expect(result.trialStartDate).toBeUndefined();
            expect(result.subscriptionStartDate).toEqual(now);
        });

        it('sets subscriptionStartDate to trialEndDate when a trial with end_at exists', () => {
            const trialStart = '2024-01-01T00:00:00Z';
            const trialEnd = '2024-01-31T00:00:00Z';
            const subscription = {
                pricing_plan_schedule_infos: [
                    makeScheduleInfo('TRIAL', trialStart, trialEnd),
                    makeScheduleInfo('DEFAULT', '2024-02-01T00:00:00Z'),
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getFallbackTrialAndSubscriptionStartAndEndDates(subscription);

            expect(result.subscriptionStartDate).toEqual(result.trialEndDate);
        });

        it('computes subscriptionEndDate by projecting the subscription duration from now', () => {
            const subStart = '2024-02-01T00:00:00Z';
            const subEnd = '2025-02-01T00:00:00Z'; // 1 year
            const subscription = {
                pricing_plan_schedule_infos: [
                    makeScheduleInfo('DEFAULT', subStart, subEnd),
                ],
            } as unknown as PricingPlanSubscriptionExpanded;

            const result = getFallbackTrialAndSubscriptionStartAndEndDates(subscription);

            const diff = new Date(subEnd).getTime() - new Date(subStart).getTime();
            expect(result.subscriptionEndDate).toEqual(new Date(now.getTime() + diff));
        });
    });

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

    describe('getMostRecentPricingPlan', () => {
        const withPlans = (...names: (string | undefined)[]) =>
            ({
                pricing_plan_schedule_infos: names.map((name) => ({
                    pricing_plan_version: { pricing_plan: { name } },
                })),
            }) as unknown as PricingPlanSubscriptionExpanded;

        it('returns the plan of the last schedule info, since later ones supersede earlier ones', () => {
            expect(getMostRecentPricingPlan(withPlans('Starter', 'Pro'))?.name).toBe('Pro');
        });

        it('returns undefined when there are no schedule infos', () => {
            expect(getMostRecentPricingPlan(withPlans())).toBeUndefined();
        });

        it('returns undefined when there is no subscription', () => {
            expect(getMostRecentPricingPlan(undefined)).toBeUndefined();
        });

        it('returns undefined when the schedule info carries no plan', () => {
            const subscription = {
                pricing_plan_schedule_infos: [{}],
            } as unknown as PricingPlanSubscriptionExpanded;

            expect(getMostRecentPricingPlan(subscription)).toBeUndefined();
        });
    });

    describe('getSubscriptionName', () => {
        const createSubscription = ({
            name,
            planName,
        }: { name?: string; planName?: string } = {}) =>
            ({
                name,
                pricing_plan_schedule_infos: [
                    { pricing_plan_version: { pricing_plan: { name: planName } } },
                ],
            }) as unknown as PricingPlanSubscriptionExpanded;

        it('prefers the name the subscription was given', () => {
            const subscription = createSubscription({ name: 'My plan', planName: 'Pro' });

            expect(getSubscriptionName({ subscription, fallback: 'Subscription' })).toBe('My plan');
        });

        it('falls back to the most recent pricing plan name', () => {
            const subscription = createSubscription({ planName: 'Pro' });

            expect(getSubscriptionName({ subscription, fallback: 'Subscription' })).toBe('Pro');
        });

        it('falls back to the given fallback when neither is named', () => {
            const subscription = createSubscription();

            expect(getSubscriptionName({ subscription, fallback: 'Subscription' })).toBe(
                'Subscription',
            );
        });

        it('treats an empty name as no name', () => {
            const subscription = createSubscription({ name: '', planName: 'Pro' });

            expect(getSubscriptionName({ subscription, fallback: 'Subscription' })).toBe('Pro');
        });

        it('falls back when there is no subscription yet', () => {
            expect(
                getSubscriptionName({ subscription: undefined, fallback: 'Subscription details' }),
            ).toBe('Subscription details');
        });
    });
});
