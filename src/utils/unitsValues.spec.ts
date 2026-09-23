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
import { FALLBACK_UNITS_NUMBER, getInitialUnitsValues } from './unitsValues';

const createConfig = ({ id, defaultUnitsNumber }: { id: string; defaultUnitsNumber?: string }) =>
    ({
        object_type: 'PRICING_ITEM_CONFIG',
        id,
        order: 1,
        billing_in_advance: false,
        details: { pricing_type: 'FLAT' },
        ...(defaultUnitsNumber && { default_units: { number: defaultUnitsNumber } }),
    }) satisfies PricingItemConfigExtended;

const createScheduleInfo = ({
    items,
    unitsValues,
}: {
    items: PricingItemExtended[];
    unitsValues?: PricingPlanSchedule['units'];
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
        units: unitsValues,
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

describe('unitsValues utils', () => {
    describe('getInitialUnitsValues', () => {
        it('should fill in the number the plan defaults to for a units entry the schedule leaves open', () => {
            const scheduleInfo = createScheduleInfo({
                items: [
                    createItem([
                        createConfig({ id: 'config-1', defaultUnitsNumber: '3' }),
                        createConfig({ id: 'config-2', defaultUnitsNumber: '5' }),
                    ]),
                ],
                unitsValues: [
                    { pricing_item_config_id: 'config-1' },
                    { pricing_item_config_id: 'config-2' },
                ],
            });

            expect(getInitialUnitsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '3' },
                { pricing_item_config_id: 'config-2', number: '5' },
            ]);
        });

        it('should keep the number the schedule itself carries', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1', defaultUnitsNumber: '3' })])],
                unitsValues: [{ pricing_item_config_id: 'config-1', number: '10' }],
            });

            expect(getInitialUnitsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
            ]);
        });

        it('should fall back to a single unit when the plan defines no default', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1' })])],
                unitsValues: [{ pricing_item_config_id: 'config-1' }],
            });

            expect(getInitialUnitsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: FALLBACK_UNITS_NUMBER },
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
                                configs: [
                                    createConfig({ id: 'monthly-config', defaultUnitsNumber: '2' }),
                                ],
                            },
                        ],
                        pricing_currency_configs: [
                            {
                                currency: 'EUR',
                                configs: [
                                    createConfig({ id: 'eur-config', defaultUnitsNumber: '4' }),
                                ],
                                billing_period_configs: [
                                    {
                                        billing_period: { type: 'YEAR', value: 1 },
                                        configs: [
                                            createConfig({
                                                id: 'eur-yearly-config',
                                                defaultUnitsNumber: '6',
                                            }),
                                        ],
                                    },
                                ],
                            },
                        ],
                    } satisfies PricingItemExtended,
                ],
                unitsValues: [
                    { pricing_item_config_id: 'monthly-config' },
                    { pricing_item_config_id: 'eur-config' },
                    { pricing_item_config_id: 'eur-yearly-config' },
                ],
            });

            expect(getInitialUnitsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'monthly-config', number: '2' },
                { pricing_item_config_id: 'eur-config', number: '4' },
                { pricing_item_config_id: 'eur-yearly-config', number: '6' },
            ]);
        });

        it('should drop everything but the id and the number a units entry is priced on', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1' })])],
                unitsValues: [
                    {
                        pricing_item_config_id: 'config-1',
                        number: '2',
                        start_at: '2024-01-01T00:00:00Z',
                        end_at: '2024-12-31T23:59:59Z',
                    } satisfies ConfiguredMeterValue,
                ],
            });

            expect(getInitialUnitsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '2' },
            ]);
        });

        it('should return nothing when the schedule lists no units at all', () => {
            expect(getInitialUnitsValues(undefined)).toBeUndefined();

            expect(
                getInitialUnitsValues(
                    createScheduleInfo({ items: [createItem([createConfig({ id: 'config-1' })])] }),
                ),
            ).toBeUndefined();

            expect(
                getInitialUnitsValues(
                    createScheduleInfo({
                        items: [createItem([createConfig({ id: 'config-1' })])],
                        unitsValues: [],
                    }),
                ),
            ).toBeUndefined();
        });
    });
});
