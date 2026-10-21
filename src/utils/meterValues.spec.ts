import type {
    ConfiguredMeterValue,
    PricingCategoryExtended,
    PricingExtended,
    PricingItemConfigExtended,
    PricingItemExtended,
    PricingPlanSchedule,
    PricingPlanScheduleInfoExpanded,
    PricingPlanVersionExtended,
} from '@solvimon/solvimon-types';
import {
    FALLBACK_METER_NUMBER,
    getInitialMeterValues,
    getMeterValuesOfEnabledPricings,
    getSeatConfigIdByPricingId,
} from './meterValues';

describe.each([
    { kind: 'seats', scheduleKey: 'seats_values', planDefaultKey: 'default_seats_value' },
    { kind: 'units', scheduleKey: 'units', planDefaultKey: 'default_units' },
] as const)('getInitialMeterValues($kind)', ({ kind, scheduleKey, planDefaultKey }) => {
    const createConfig = ({ id, defaultNumber }: { id: string; defaultNumber?: string }) =>
        ({
            object_type: 'PRICING_ITEM_CONFIG',
            id,
            order: 1,
            billing_in_advance: false,
            details: { pricing_type: 'FLAT' },
            ...(defaultNumber && { [planDefaultKey]: { number: defaultNumber } }),
        }) satisfies PricingItemConfigExtended;

    const createScheduleInfo = ({
        items,
        meterValues,
    }: {
        items: PricingItemExtended[];
        meterValues?: ConfiguredMeterValue[];
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
            pricing_plan_version_id: 'version-1',
            pricing_plan_subscription_id: 'subscription-1',
            [scheduleKey]: meterValues,
        } satisfies PricingPlanSchedule;

        return {
            id: 'schedule-1',
            type: 'DEFAULT',
            start_at: '2024-01-01T00:00:00Z',
            pricing_plan_version_id: 'version-1',
            pricing_plan_version: pricingPlanVersion,
            pricing_plan_schedule: pricingPlanSchedule,
        } satisfies PricingPlanScheduleInfoExpanded;
    };

    const createItem = (configs: PricingItemExtended['configs']) =>
        ({
            id: 'item-1',
            product_item_ids: [],
            configs,
        }) satisfies PricingItemExtended;

    it('should fill in the number the plan defaults to for an entry the schedule leaves open', () => {
        const scheduleInfo = createScheduleInfo({
            items: [
                createItem([
                    createConfig({ id: 'config-1', defaultNumber: '3' }),
                    createConfig({ id: 'config-2', defaultNumber: '5' }),
                ]),
            ],
            meterValues: [
                { pricing_item_config_id: 'config-1' },
                { pricing_item_config_id: 'config-2' },
            ],
        });

        expect(getInitialMeterValues(kind, scheduleInfo)).toEqual([
            { pricing_item_config_id: 'config-1', number: '3' },
            { pricing_item_config_id: 'config-2', number: '5' },
        ]);
    });

    it('should keep the number the schedule itself carries', () => {
        const scheduleInfo = createScheduleInfo({
            items: [createItem([createConfig({ id: 'config-1', defaultNumber: '3' })])],
            meterValues: [{ pricing_item_config_id: 'config-1', number: '10' }],
        });

        expect(getInitialMeterValues(kind, scheduleInfo)).toEqual([
            { pricing_item_config_id: 'config-1', number: '10' },
        ]);
    });

    it('should fall back to one when the plan defines no default', () => {
        const scheduleInfo = createScheduleInfo({
            items: [createItem([createConfig({ id: 'config-1' })])],
            meterValues: [{ pricing_item_config_id: 'config-1' }],
        });

        expect(getInitialMeterValues(kind, scheduleInfo)).toEqual([
            { pricing_item_config_id: 'config-1', number: FALLBACK_METER_NUMBER },
        ]);
    });

    it('should read defaults from configs nested per currency and billing period', () => {
        const scheduleInfo = createScheduleInfo({
            items: [
                {
                    id: 'item-1',
                    product_item_ids: [],
                    billing_period_configs: [
                        {
                            billing_period: { type: 'MONTH', value: 1 },
                            configs: [createConfig({ id: 'monthly-config', defaultNumber: '2' })],
                        },
                    ],
                    pricing_currency_configs: [
                        {
                            currency: 'EUR',
                            configs: [createConfig({ id: 'eur-config', defaultNumber: '4' })],
                            billing_period_configs: [
                                {
                                    billing_period: { type: 'YEAR', value: 1 },
                                    configs: [
                                        createConfig({
                                            id: 'eur-yearly-config',
                                            defaultNumber: '6',
                                        }),
                                    ],
                                },
                            ],
                        },
                    ],
                } satisfies PricingItemExtended,
            ],
            meterValues: [
                { pricing_item_config_id: 'monthly-config' },
                { pricing_item_config_id: 'eur-config' },
                { pricing_item_config_id: 'eur-yearly-config' },
            ],
        });

        expect(getInitialMeterValues(kind, scheduleInfo)).toEqual([
            { pricing_item_config_id: 'monthly-config', number: '2' },
            { pricing_item_config_id: 'eur-config', number: '4' },
            { pricing_item_config_id: 'eur-yearly-config', number: '6' },
        ]);
    });

    it('should drop everything but the id and the number an entry is priced on', () => {
        const scheduleInfo = createScheduleInfo({
            items: [createItem([createConfig({ id: 'config-1' })])],
            meterValues: [
                {
                    pricing_item_config_id: 'config-1',
                    number: '2',
                    start_at: '2024-01-01T00:00:00Z',
                    end_at: '2024-12-31T23:59:59Z',
                } satisfies ConfiguredMeterValue,
            ],
        });

        expect(getInitialMeterValues(kind, scheduleInfo)).toEqual([
            { pricing_item_config_id: 'config-1', number: '2' },
        ]);
    });

    it('should return nothing when the schedule lists none at all', () => {
        expect(getInitialMeterValues(kind, undefined)).toBeUndefined();

        expect(
            getInitialMeterValues(
                kind,
                createScheduleInfo({ items: [createItem([createConfig({ id: 'config-1' })])] }),
            ),
        ).toBeUndefined();

        expect(
            getInitialMeterValues(
                kind,
                createScheduleInfo({
                    items: [createItem([createConfig({ id: 'config-1' })])],
                    meterValues: [],
                }),
            ),
        ).toBeUndefined();
    });
});

describe('seats of addons and pricing group members', () => {
    const createSeatPricing = ({
        id,
        configId,
        defaultNumber,
        groupId,
        productType = 'DEFAULT',
    }: {
        id: string;
        configId: string;
        defaultNumber?: string;
        groupId?: string;
        productType?: PricingExtended['product_type'];
    }) =>
        ({
            object_type: 'PRICING',
            id,
            product_ids: [],
            product_type: productType,
            ...(groupId && { pricing_group_id: groupId }),
            items: [
                {
                    id: `${id}-item`,
                    product_item_ids: [`${id}-product-item`],
                    product_items: [
                        {
                            object_type: 'PRODUCT_ITEM',
                            id: `${id}-product-item`,
                            product_id: `${id}-product`,
                            name: `${id} seats`,
                            reference: `${id}-seats`,
                            status: 'ACTIVE',
                            type: 'REVENUE',
                            model_type: 'PER_SEAT',
                        },
                    ],
                    configs: [
                        {
                            object_type: 'PRICING_ITEM_CONFIG',
                            id: configId,
                            order: 1,
                            billing_in_advance: true,
                            details: { pricing_type: 'FLAT' },
                            ...(defaultNumber && {
                                default_seats_value: { number: defaultNumber },
                            }),
                        },
                    ],
                },
            ],
        }) satisfies PricingExtended;

    const serverGroupPricings = [
        createSeatPricing({
            id: 'h200',
            configId: 'h200-config',
            defaultNumber: '2',
            groupId: 'server-type',
            productType: 'ADDON',
        }),
        createSeatPricing({
            id: 'b300',
            configId: 'b300-config',
            groupId: 'server-type',
            productType: 'ADDON',
        }),
    ];

    const createScheduleInfo = ({
        pricings = [],
        groupPricings = [],
        seatsValues,
    }: {
        pricings?: PricingExtended[];
        groupPricings?: PricingExtended[];
        seatsValues?: ConfiguredMeterValue[];
    }) =>
        ({
            id: 'schedule-1',
            type: 'DEFAULT',
            start_at: '2024-01-01T00:00:00Z',
            pricing_plan_version_id: 'version-1',
            pricing_plan_version: {
                object_type: 'PRICING_PLAN_VERSION',
                id: 'version-1',
                pricing_plan_id: 'plan-1',
                version: 1,
                status: 'ACTIVE',
                pricing_categories: [
                    {
                        product_category_id: 'category-1',
                        pricings,
                        pricing_groups: [
                            {
                                object_type: 'PRICING_GROUP',
                                id: 'server-type',
                                pricing_plan_version_id: 'version-1',
                                name: 'Server type',
                                product_type: 'ADDON',
                                selection_constraint: 'EXACTLY_ONE',
                                pricings: groupPricings,
                            },
                        ],
                    },
                ],
                pricing_plan: {
                    object_type: 'PRICING_PLAN',
                    id: 'plan-1',
                    reference: 'plan-reference',
                    name: 'Plan',
                    type: 'STANDARD',
                    variant: 'DEFAULT',
                },
            },
            pricing_plan_schedule: {
                id: 'schedule-1',
                type: 'DEFAULT',
                start_at: '2024-01-01T00:00:00Z',
                pricing_plan_version_id: 'version-1',
                pricing_plan_subscription_id: 'subscription-1',
                seats_values: seatsValues,
            },
        }) satisfies PricingPlanScheduleInfoExpanded;

    it('should start every seat-based group member on its plan default when the schedule lists none', () => {
        const scheduleInfo = createScheduleInfo({ groupPricings: serverGroupPricings });

        expect(getInitialMeterValues('seats', scheduleInfo)).toEqual([
            { pricing_item_config_id: 'h200-config', number: '2' },
            { pricing_item_config_id: 'b300-config', number: FALLBACK_METER_NUMBER },
        ]);
    });

    it('should not list a group member twice when the schedule already carries its seats', () => {
        const scheduleInfo = createScheduleInfo({
            groupPricings: serverGroupPricings,
            seatsValues: [{ pricing_item_config_id: 'h200-config', number: '5' }],
        });

        expect(getInitialMeterValues('seats', scheduleInfo)).toEqual([
            { pricing_item_config_id: 'h200-config', number: '5' },
            { pricing_item_config_id: 'b300-config', number: FALLBACK_METER_NUMBER },
        ]);
    });

    it('should add no units for group members', () => {
        const scheduleInfo = createScheduleInfo({ groupPricings: serverGroupPricings });

        expect(getInitialMeterValues('units', scheduleInfo)).toBeUndefined();
    });

    it('should keep only the seats of regular pricings and of the picked addons', () => {
        const scheduleInfo = createScheduleInfo({
            pricings: [
                createSeatPricing({ id: 'base', configId: 'base-config' }),
                createSeatPricing({
                    id: 'support',
                    configId: 'support-config',
                    productType: 'ADDON',
                }),
            ],
            groupPricings: serverGroupPricings,
            seatsValues: [{ pricing_item_config_id: 'base-config' }],
        });
        const seatsValues = getInitialMeterValues('seats', scheduleInfo);

        expect(getMeterValuesOfEnabledPricings(seatsValues, scheduleInfo, ['b300'])).toEqual([
            { pricing_item_config_id: 'base-config', number: FALLBACK_METER_NUMBER },
            { pricing_item_config_id: 'b300-config', number: FALLBACK_METER_NUMBER },
        ]);
    });

    it('should leave nothing to send when only unpicked addons have seats', () => {
        const scheduleInfo = createScheduleInfo({ groupPricings: serverGroupPricings });

        expect(
            getMeterValuesOfEnabledPricings(
                getInitialMeterValues('seats', scheduleInfo),
                scheduleInfo,
                [],
            ),
        ).toBeUndefined();
    });

    it('should bill each seat-based pricing on its config for the currency on offer', () => {
        const seatPricing = createSeatPricing({
            id: 'h200',
            configId: 'h200-config',
            groupId: 'server-type',
        });
        const [item] = seatPricing.items;
        const config = item.configs[0];
        const perCurrency = {
            ...seatPricing,
            items: [
                {
                    ...item,
                    configs: undefined,
                    pricing_currency_configs: [
                        { currency: 'USD', configs: [{ ...config, id: 'h200-usd' }] },
                        { currency: 'EUR', configs: [{ ...config, id: 'h200-eur' }] },
                    ],
                },
            ],
        } satisfies PricingExtended;
        const scheduleInfo = createScheduleInfo({ groupPricings: [perCurrency] });

        expect(
            getSeatConfigIdByPricingId({
                scheduleInfo,
                pricings: [perCurrency],
                currency: 'EUR',
            }),
        ).toEqual(new Map([['h200', 'h200-eur']]));
    });
});
