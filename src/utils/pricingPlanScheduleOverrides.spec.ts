import {
    combinePricingPlanVersionWithOverrides,
    getSchedulesWithPlanData,
} from './pricingPlanScheduleOverrides';
import type {
    Pricing,
    PricingExtended,
    PricingItemConfigExtended,
    PricingItemExtended,
    PricingPlan,
    PricingPlanSchedule,
    PricingPlanScheduleInfoExpanded,
    PricingPlanVersionExtended,
    Product,
    ProductItemExtended,
} from '@solvimon/solvimon-types';
import type { PricingPlanSubscriptionExpanded } from '@/types/subscription';

const createConfig = ({
    id,
    quantity,
    order = 1,
}: {
    id: string;
    quantity: string;
    order?: number;
}): PricingItemConfigExtended => ({
    object_type: 'PRICING_ITEM_CONFIG',
    id,
    order,
    billing_in_advance: false,
    details: {
        pricing_type: 'FLAT',
        bands: [{ amount: { currency: 'EUR', quantity } }],
    },
});

const getBandQuantity = (config: PricingItemConfigExtended | undefined) =>
    config?.details.bands?.[0]?.amount?.quantity;

const product: Product = {
    object_type: 'PRODUCT',
    id: 'prod_1',
    category_id: 'prca_1',
    name: 'Platform',
    product_type: 'DEFAULT',
    status: 'ACTIVE',
    reference: 'platform',
};

const productItem: ProductItemExtended = {
    object_type: 'PRODUCT_ITEM',
    id: 'prit_1',
    type: 'REVENUE',
    product_id: 'prod_1',
    name: 'Platform fee',
    model_type: 'RECURRING',
    reference: 'platform_fee',
    status: 'ACTIVE',
};

const createPricing = ({
    id,
    items,
    productType = 'DEFAULT',
}: {
    id: string;
    items: PricingItemExtended[];
    productType?: Pricing['product_type'];
}): PricingExtended => ({
    object_type: 'PRICING',
    id,
    name: 'Platform fee',
    product_ids: ['prod_1'],
    product_type: productType,
    products: [product],
    items,
});

const pricingPlan: PricingPlan = {
    object_type: 'PRICING_PLAN',
    id: 'ppln_1',
    reference: 'growth',
    name: 'Growth',
    type: 'STANDARD',
    variant: 'DEFAULT',
};

const createVersion = (pricings: PricingExtended[]): PricingPlanVersionExtended => ({
    object_type: 'PRICING_PLAN_VERSION',
    id: 'ppve_1',
    version: 1,
    status: 'ACTIVE',
    pricing_plan_id: 'ppln_1',
    pricing_plan: pricingPlan,
    pricing_categories: [
        {
            object_type: 'PRICING_CATEGORY',
            product_category_id: 'prca_1',
            pricings,
            pricing_groups: [],
        },
    ],
});

const getFirstPricing = (version: PricingPlanVersionExtended) =>
    version.pricing_categories?.[0]?.pricings?.[0];

const getFirstConfigs = (version: PricingPlanVersionExtended) =>
    getFirstPricing(version)?.items?.[0]?.configs;

describe('pricingPlanScheduleOverrides', () => {
    describe('combinePricingPlanVersionWithOverrides', () => {
        const baseVersion = createVersion([
            createPricing({
                id: 'pric_1',
                items: [
                    {
                        id: 'prii_1',
                        product_item_ids: ['prit_1'],
                        product_items: [productItem],
                        configs: [
                            createConfig({ id: 'pico_1', quantity: '10', order: 1 }),
                            createConfig({ id: 'pico_2', quantity: '20', order: 2 }),
                        ],
                    },
                ],
            }),
        ]);

        it('returns the version untouched when the schedule has no overrides', () => {
            expect(
                combinePricingPlanVersionWithOverrides({
                    pricingPlanVersion: baseVersion,
                    overridePricings: undefined,
                }),
            ).toBe(baseVersion);
        });

        it('merges a specific override into the config it customizes and leaves its siblings alone', () => {
            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: baseVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'SPECIFIC',
                                configs: [
                                    {
                                        ...createConfig({ id: 'pico_override', quantity: '5' }),
                                        original_pricing_item_config_id: 'pico_1',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const configs = getFirstConfigs(combined);

            expect(configs).toHaveLength(2);
            expect(getBandQuantity(configs?.[0])).toBe('5');
            expect(getBandQuantity(configs?.[1])).toBe('20');
        });

        it('keeps the expanded data the override does not repeat', () => {
            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: baseVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'SPECIFIC',
                                configs: [
                                    {
                                        ...createConfig({ id: 'pico_override', quantity: '5' }),
                                        original_pricing_item_config_id: 'pico_1',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const pricing = getFirstPricing(combined);

            expect(pricing?.name).toBe('Platform fee');
            expect(pricing?.products).toEqual([product]);
            expect(pricing?.items?.[0]?.product_items).toEqual([productItem]);
        });

        it('takes the override its id so the schedule still enables the pricing it replaces', () => {
            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: baseVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [],
                    },
                ],
            });

            const pricing = getFirstPricing(combined);

            expect(pricing?.id).toBe('pric_override');
            expect(pricing?.original_pricing_id).toBe('pric_1');
        });

        it('drops the configs an ALL override does not cover', () => {
            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: baseVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'ALL',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'ALL',
                                configs: [
                                    {
                                        ...createConfig({ id: 'pico_override', quantity: '5' }),
                                        original_pricing_item_config_id: 'pico_1',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const configs = getFirstConfigs(combined);

            expect(configs).toHaveLength(1);
            expect(getBandQuantity(configs?.[0])).toBe('5');
        });

        it('merges an override into the currency and billing period it applies to', () => {
            const monthly = { type: 'MONTH', value: 1 } as const;
            const yearly = { type: 'YEAR', value: 1 } as const;
            const version = createVersion([
                createPricing({
                    id: 'pric_1',
                    items: [
                        {
                            id: 'prii_1',
                            product_item_ids: ['prit_1'],
                            pricing_currency_configs: [
                                {
                                    currency: 'EUR',
                                    billing_period_configs: [
                                        {
                                            billing_period: monthly,
                                            configs: [
                                                createConfig({ id: 'pico_eur_m', quantity: '10' }),
                                            ],
                                        },
                                        {
                                            billing_period: yearly,
                                            configs: [
                                                createConfig({ id: 'pico_eur_y', quantity: '100' }),
                                            ],
                                        },
                                    ],
                                },
                                {
                                    currency: 'USD',
                                    billing_period_configs: [
                                        {
                                            billing_period: monthly,
                                            configs: [
                                                createConfig({ id: 'pico_usd_m', quantity: '12' }),
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            ]);

            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: version,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'SPECIFIC',
                                pricing_currency_configs: [
                                    {
                                        currency: 'EUR',
                                        billing_period_configs: [
                                            {
                                                billing_period: monthly,
                                                configs: [
                                                    {
                                                        ...createConfig({
                                                            id: 'pico_override',
                                                            quantity: '7',
                                                        }),
                                                        original_pricing_item_config_id:
                                                            'pico_eur_m',
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const currencyConfigs = getFirstPricing(combined)?.items?.[0]?.pricing_currency_configs;
            const euro = currencyConfigs?.find((config) => config.currency === 'EUR');
            const dollar = currencyConfigs?.find((config) => config.currency === 'USD');

            expect(getBandQuantity(euro?.billing_period_configs?.[0]?.configs?.[0])).toBe('7');
            expect(getBandQuantity(euro?.billing_period_configs?.[1]?.configs?.[0])).toBe('100');
            expect(getBandQuantity(dollar?.billing_period_configs?.[0]?.configs?.[0])).toBe('12');
        });

        it('applies overrides to pricings inside a pricing group', () => {
            const version = createVersion([]);
            const groupedVersion: PricingPlanVersionExtended = {
                ...version,
                pricing_categories: [
                    {
                        ...version.pricing_categories![0],
                        pricings: [],
                        pricing_groups: [
                            {
                                object_type: 'PRICING_GROUP',
                                id: 'pgrp_1',
                                name: 'Credit packs',
                                product_type: 'ADDON',
                                selection_constraint: 'EXACTLY_ONE',
                                pricings: [
                                    createPricing({
                                        id: 'pric_1',
                                        productType: 'ADDON',
                                        items: [
                                            {
                                                id: 'prii_1',
                                                product_item_ids: ['prit_1'],
                                                configs: [
                                                    createConfig({
                                                        id: 'pico_1',
                                                        quantity: '10',
                                                    }),
                                                ],
                                            },
                                        ],
                                    }),
                                ],
                            },
                        ],
                    },
                ],
            };

            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: groupedVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'SPECIFIC',
                                configs: [
                                    {
                                        ...createConfig({ id: 'pico_override', quantity: '5' }),
                                        original_pricing_item_config_id: 'pico_1',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });

            const grouped = combined.pricing_categories?.[0]?.pricing_groups?.[0]?.pricings?.[0];

            expect(grouped?.id).toBe('pric_override');
            expect(getBandQuantity(grouped?.items?.[0]?.configs?.[0])).toBe('5');
        });

        it('ignores an override that no longer matches a pricing in the version', () => {
            const combined = combinePricingPlanVersionWithOverrides({
                pricingPlanVersion: baseVersion,
                overridePricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_gone',
                        override: 'ALL',
                        items: [],
                    },
                ],
            });

            expect(combined.pricing_categories?.[0]?.pricings).toHaveLength(1);
            expect(getFirstPricing(combined)?.id).toBe('pric_1');
            expect(getBandQuantity(getFirstConfigs(combined)?.[0])).toBe('10');
        });
    });

    describe('getSchedulesWithPlanData', () => {
        it('pairs every schedule with its plan and its combined version', () => {
            const version = createVersion([
                createPricing({
                    id: 'pric_1',
                    items: [
                        {
                            id: 'prii_1',
                            product_item_ids: ['prit_1'],
                            configs: [createConfig({ id: 'pico_1', quantity: '10' })],
                        },
                    ],
                }),
            ]);
            const schedule: PricingPlanSchedule = {
                id: 'ppsc_1',
                start_at: '2026-01-01T00:00:00Z',
                pricing_plan_version_id: 'ppve_1',
                pricing_plan_subscription_id: 'ppsu_1',
                type: 'DEFAULT',
                override_pricings: [
                    {
                        object_type: 'PRICING',
                        id: 'pric_override',
                        product_ids: ['prod_1'],
                        original_pricing_id: 'pric_1',
                        override: 'SPECIFIC',
                        items: [
                            {
                                id: 'prii_override',
                                product_item_ids: ['prit_1'],
                                original_pricing_item_id: 'prii_1',
                                override: 'SPECIFIC',
                                configs: [
                                    {
                                        ...createConfig({ id: 'pico_override', quantity: '5' }),
                                        original_pricing_item_config_id: 'pico_1',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const subscription = {
                id: 'ppsu_1',
                pricing_plan_schedule_infos: [
                    {
                        id: 'ppsc_1',
                        start_at: schedule.start_at,
                        pricing_plan_version_id: 'ppve_1',
                        type: 'DEFAULT',
                        pricing_plan_version: version,
                        pricing_plan_schedule: schedule,
                    } as PricingPlanScheduleInfoExpanded,
                ],
            } as PricingPlanSubscriptionExpanded;

            const [scheduleWithPlanData, ...rest] = getSchedulesWithPlanData(subscription);

            expect(rest).toHaveLength(0);
            expect(scheduleWithPlanData.schedule).toBe(schedule);
            expect(scheduleWithPlanData.selectedPricingPlan).toEqual(pricingPlan);
            expect(
                getBandQuantity(
                    getFirstConfigs(scheduleWithPlanData.selectedPricingPlanVersion!)?.[0],
                ),
            ).toBe('5');
        });
    });
});
