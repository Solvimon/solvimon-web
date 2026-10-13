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
import { FALLBACK_METER_NUMBER, getInitialMeterValues } from './meterValues';

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
