import {
    getAllPricingsFromScheduleInfos,
    getFirstPricingPlanScheduleOfType,
    getPricingItemConfigMetaById,
    getScheduleCustomizations,
} from './pricingPlanSchedule';
import type {
    BillingPeriod,
    ConfiguredMeterValue,
    EnabledPricing,
    PricingCategoryExtended,
    PricingExtended,
    PricingItemConfigExtended,
    PricingItemExtended,
    PricingPlanSchedule,
    PricingPlanScheduleInfoExpanded,
    PricingPlanVersionExtended,
} from '@solvimon/solvimon-types';

describe('pricingPlanSchedule utils', () => {
    describe('getPricingItemConfigMetaById', () => {
        const monthlyBillingPeriod = {
            type: 'MONTH',
            value: 1,
        } satisfies BillingPeriod;

        const createConfig = ({
            id,
            currency,
        }: {
            id: string;
            currency?: string;
        }) =>
            ({
                object_type: 'PRICING_ITEM_CONFIG',
                id,
                type: 'FLAT',
                order: 1,
                billing_in_advance: false,
                ...(currency && {
                    bands: [
                        {
                            amount: {
                                currency,
                                quantity: '10',
                            },
                        },
                    ],
                }),
            }) satisfies PricingItemConfigExtended;

        const createItem = ({
            billingPeriodConfigs,
            configs,
        }: {
            billingPeriodConfigs?: PricingItemExtended['billing_period_configs'];
            configs?: PricingItemExtended['configs'];
        }) =>
            ({
                id: 'item-1',
                product_item_ids: [],
                billing_period_configs: billingPeriodConfigs,
                configs,
            }) satisfies PricingItemExtended;

        const createPricingPlanScheduleInfo = ({
            items,
        }: {
            items: PricingItemExtended[];
        }) => {
            const pricing = {
                object_type: 'PRICING',
                id: 'pricing-1',
                product_ids: [],
                items,
            } satisfies PricingExtended;

            const pricingCategory = {
                product_category_id: 'category-1',
                pricings: [pricing],
            } satisfies PricingCategoryExtended;

            const pricingPlanVersion = {
                object_type: 'PRICING_PLAN_VERSION',
                id: 'version-1',
                pricing_plan_id: 'plan-1',
                version: 1,
                status: 'ACTIVE',
                pricing_categories: [pricingCategory],
                pricing_plan: {
                    object_type: 'PRICING_PLAN',
                    id: 'plan-1',
                    reference: 'plan-reference',
                    name: 'Plan',
                    type: 'STANDARD',
                    variant: 'DEFAULT',
                },
            } satisfies PricingPlanVersionExtended;

            const pricingPlanSchedule = {
                id: 'schedule-1',
                type: 'DEFAULT',
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } satisfies PricingPlanSchedule;

            return {
                id: 'schedule-1',
                type: 'DEFAULT',
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_version: pricingPlanVersion,
                pricing_plan_schedule: pricingPlanSchedule,
            } satisfies PricingPlanScheduleInfoExpanded;
        };

        it('should return config meta from billing period configs and item configs', () => {
            const pricingPlanScheduleInfo = createPricingPlanScheduleInfo({
                items: [
                    createItem({
                        billingPeriodConfigs: [
                            {
                                billing_period: monthlyBillingPeriod,
                                configs: [
                                    createConfig({
                                        id: 'billing-config-with-currency',
                                        currency: 'EUR',
                                    }),
                                    createConfig({
                                        id: 'billing-config-without-currency',
                                    }),
                                ],
                            },
                        ],
                        configs: [
                            createConfig({
                                id: 'item-config-with-currency',
                                currency: 'USD',
                            }),
                            createConfig({
                                id: 'item-config-without-currency',
                            }),
                        ],
                    }),
                ],
            });

            const result = getPricingItemConfigMetaById({
                pricingPlanScheduleInfo,
            });

            expect(result.get('billing-config-with-currency')).toEqual({
                currency: 'EUR',
                billingPeriod: monthlyBillingPeriod,
            });
            expect(result.get('billing-config-without-currency')).toEqual({
                billingPeriod: monthlyBillingPeriod,
            });
            expect(result.get('item-config-with-currency')).toEqual({
                currency: 'USD',
            });
            expect(result.get('item-config-without-currency')).toEqual({});
        });
    });

    describe('getFirstPricingPlanScheduleOfType', () => {
        const createMockScheduleInfo = (
            id: string,
            type: 'DEFAULT' | 'TRIAL' | undefined,
        ): PricingPlanScheduleInfoExpanded => ({
            id,
            start_at: '2024-01-01T00:00:00Z',
            end_at: '2024-12-31T23:59:59Z',
            pricing_plan_version_id: 'version-1',
            type,
            pricing_plan_version: {} as any,
            pricing_plan_schedule: {
                id,
                type,
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } as any,
        });

        it('should return the first schedule with matching type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
                createMockScheduleInfo('schedule-3', 'DEFAULT'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-1');
            expect(result?.pricing_plan_schedule.type).toBe('DEFAULT');
        });

        it('should return the first TRIAL schedule when searching for TRIAL type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
                createMockScheduleInfo('schedule-3', 'TRIAL'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'TRIAL',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-2');
            expect(result?.pricing_plan_schedule.type).toBe('TRIAL');
        });

        it('should return undefined when no schedule matches the type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'DEFAULT'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'TRIAL',
            });

            expect(result).toBeUndefined();
        });

        it('should return undefined when searching for undefined type and no schedule has undefined type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', 'TRIAL'),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: undefined,
            });

            expect(result).toBeUndefined();
        });

        it('should return the first schedule with undefined type when searching for undefined', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
                createMockScheduleInfo('schedule-2', undefined),
                createMockScheduleInfo('schedule-3', undefined),
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: undefined,
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-2');
            expect(result?.pricing_plan_schedule.type).toBeUndefined();
        });

        it('should handle empty array', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeUndefined();
        });

        it('should only check pricing_plan_schedule.type, not the top-level type', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                {
                    id: 'schedule-1',
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                    pricing_plan_version_id: 'version-1',
                    type: 'TRIAL', // top-level type is TRIAL
                    pricing_plan_version: {} as any,
                    pricing_plan_schedule: {
                        id: 'schedule-1',
                        type: 'DEFAULT', // but pricing_plan_schedule.type is DEFAULT
                        start_at: '2024-01-01T00:00:00Z',
                        end_at: '2024-12-31T23:59:59Z',
                        pricing_plan_version_id: 'version-1',
                        pricing_plan_subscription_id: 'subscription-1',
                    } as any,
                },
            ];

            const result = getFirstPricingPlanScheduleOfType({
                pricingPlanScheduleInfos: schedules,
                type: 'DEFAULT',
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe('schedule-1');
            expect(result?.type).toBe('TRIAL'); // top-level type
            expect(result?.pricing_plan_schedule.type).toBe('DEFAULT'); // checked type
        });
    });

    describe('getScheduleCustomizations', () => {
        const createMockScheduleInfo = (
            id: string,
            type: 'DEFAULT' | 'TRIAL' | undefined,
        ): PricingPlanScheduleInfoExpanded => ({
            id,
            start_at: '2024-01-01T00:00:00Z',
            end_at: '2024-12-31T23:59:59Z',
            pricing_plan_version_id: 'version-1',
            type,
            pricing_plan_version: {} as any,
            pricing_plan_schedule: {
                id,
                type,
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
            } as any,
        });

        it('should return undefined when no DEFAULT schedule exists', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'TRIAL'),
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                enabledPricings: [{ pricing_id: 'pricing-1' }],
            });

            expect(result).toBeUndefined();
        });

        it('should return undefined when no enabledPricings, seatsValues, pricingCurrency, or billingPeriod are provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
            });

            expect(result).toBeUndefined();
        });

        it('should return customizations with enabledPricings when provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const enabledPricings: EnabledPricing[] = [
                { pricing_id: 'pricing-1', start_at: '2024-01-01T00:00:00Z' },
                { pricing_id: 'pricing-2' },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                enabledPricings,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0].pricing_plan_schedule_id).toBe('schedule-1');
            expect(result?.[0].enabled_pricings).toEqual(enabledPricings);
            expect(result?.[0].seats_values).toBeUndefined();
        });

        it('should return customizations with seatsValues when provided', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const seatsValues: ConfiguredMeterValue[] = [
                {
                    pricing_item_config_id: 'config-1',
                    number: '10',
                    amount: { quantity: '100', currency: 'USD' },
                    start_at: '2024-01-01T00:00:00Z',
                },
                {
                    pricing_item_config_id: 'config-2',
                    number: '5',
                },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                seatsValues,
            });

            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result?.[0].pricing_plan_schedule_id).toBe('schedule-1');
            expect(result?.[0].enabled_pricings).toBeUndefined();
            expect(result?.[0].seats_values).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
                { pricing_item_config_id: 'config-2', number: '5' },
            ]);
        });

        it('should correctly map seatsValues to only include pricing_item_config_id and number', () => {
            const schedules: PricingPlanScheduleInfoExpanded[] = [
                createMockScheduleInfo('schedule-1', 'DEFAULT'),
            ];
            const seatsValues: ConfiguredMeterValue[] = [
                {
                    pricing_item_config_id: 'config-1',
                    number: '10',
                    amount: { quantity: '100', currency: 'USD' },
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                    set_start_at_to_now: true,
                },
            ];

            const result = getScheduleCustomizations({
                pricingPlanScheduleInfos: schedules,
                seatsValues,
            });

            expect(result?.[0].seats_values).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
            ]);
            // Verify that other properties are not included
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('amount');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('start_at');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('end_at');
            expect(result?.[0].seats_values?.[0]).not.toHaveProperty('set_start_at_to_now');
        });
    });

    describe('getAllPricingsFromScheduleInfos', () => {
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

            const result = getAllPricingsFromScheduleInfos({ pricingPlanScheduleInfo: info });

            expect(result).toHaveLength(3);
            expect(result.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
        });

        it('returns empty array when pricing_categories is undefined', () => {
            expect(
                getAllPricingsFromScheduleInfos({ pricingPlanScheduleInfo: makeInfo(undefined) }),
            ).toEqual([]);
        });

        it('returns empty array when all categories have no pricings', () => {
            expect(
                getAllPricingsFromScheduleInfos({
                    pricingPlanScheduleInfo: makeInfo([
                        { product_category_id: 'cat-1', pricings: undefined } as any,
                    ]),
                }),
            ).toEqual([]);
        });
    });

    describe('getPricingItemConfigMetaById — pricing_currency_configs branch', () => {
        it('stores currency and billingPeriod from pricing_currency_configs billing_period_configs', () => {
            const monthlyBillingPeriod: BillingPeriod = { type: 'MONTH', value: 1 };
            const info: PricingPlanScheduleInfoExpanded = {
                id: 'schedule-1',
                type: 'DEFAULT',
                start_at: '2024-01-01T00:00:00Z',
                end_at: '2024-12-31T23:59:59Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_version: {
                    object_type: 'PRICING_PLAN_VERSION',
                    id: 'version-1',
                    pricing_plan_id: 'plan-1',
                    version: 1,
                    status: 'ACTIVE',
                    pricing_plan: { object_type: 'PRICING_PLAN', id: 'plan-1', reference: 'ref', name: 'Plan', type: 'STANDARD', variant: 'DEFAULT' },
                    pricing_categories: [
                        {
                            product_category_id: 'cat-1',
                            pricings: [
                                {
                                    object_type: 'PRICING',
                                    id: 'pricing-1',
                                    product_ids: [],
                                    items: [
                                        {
                                            id: 'item-1',
                                            product_item_ids: [],
                                            pricing_currency_configs: [
                                                {
                                                    currency: 'EUR',
                                                    billing_period_configs: [
                                                        {
                                                            billing_period: monthlyBillingPeriod,
                                                            configs: [{ id: 'cc-bp-config-1' }],
                                                        },
                                                    ],
                                                    configs: [{ id: 'cc-config-1' }],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                } as any,
                pricing_plan_schedule: {
                    id: 'schedule-1',
                    type: 'DEFAULT',
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                    pricing_plan_version_id: 'version-1',
                    pricing_plan_subscription_id: 'subscription-1',
                } as any,
            };

            const result = getPricingItemConfigMetaById({ pricingPlanScheduleInfo: info });

            expect(result.get('cc-bp-config-1')).toEqual({
                currency: 'EUR',
                billingPeriod: monthlyBillingPeriod,
            });
            expect(result.get('cc-config-1')).toEqual({ currency: 'EUR' });
        });
    });
});
