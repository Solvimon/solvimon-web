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
import { FALLBACK_SEATS_NUMBER, getInitialSeatsValues } from './seatsValues';

const createConfig = ({ id, defaultSeatsNumber }: { id: string; defaultSeatsNumber?: string }) =>
    ({
        object_type: 'PRICING_ITEM_CONFIG',
        id,
        order: 1,
        billing_in_advance: false,
        details: { pricing_type: 'FLAT' },
        ...(defaultSeatsNumber && { default_seats_value: { number: defaultSeatsNumber } }),
    }) satisfies PricingItemConfigExtended;

const createScheduleInfo = ({
    items,
    seatsValues,
}: {
    items: PricingItemExtended[];
    seatsValues?: PricingPlanSchedule['seats_values'];
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
        seats_values: seatsValues,
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

describe('seatsValues utils', () => {
    describe('getInitialSeatsValues', () => {
        it('should fill in the number the plan defaults to for a seat the schedule leaves open', () => {
            const scheduleInfo = createScheduleInfo({
                items: [
                    createItem([
                        createConfig({ id: 'config-1', defaultSeatsNumber: '3' }),
                        createConfig({ id: 'config-2', defaultSeatsNumber: '5' }),
                    ]),
                ],
                seatsValues: [
                    { pricing_item_config_id: 'config-1' },
                    { pricing_item_config_id: 'config-2' },
                ],
            });

            expect(getInitialSeatsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '3' },
                { pricing_item_config_id: 'config-2', number: '5' },
            ]);
        });

        it('should keep the number the schedule itself carries', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1', defaultSeatsNumber: '3' })])],
                seatsValues: [{ pricing_item_config_id: 'config-1', number: '10' }],
            });

            expect(getInitialSeatsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '10' },
            ]);
        });

        it('should fall back to a single seat when the plan defines no default', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1' })])],
                seatsValues: [{ pricing_item_config_id: 'config-1' }],
            });

            expect(getInitialSeatsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: FALLBACK_SEATS_NUMBER },
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
                                    createConfig({ id: 'monthly-config', defaultSeatsNumber: '2' }),
                                ],
                            },
                        ],
                        pricing_currency_configs: [
                            {
                                currency: 'EUR',
                                configs: [
                                    createConfig({ id: 'eur-config', defaultSeatsNumber: '4' }),
                                ],
                                billing_period_configs: [
                                    {
                                        billing_period: { type: 'YEAR', value: 1 },
                                        configs: [
                                            createConfig({
                                                id: 'eur-yearly-config',
                                                defaultSeatsNumber: '6',
                                            }),
                                        ],
                                    },
                                ],
                            },
                        ],
                    } satisfies PricingItemExtended,
                ],
                seatsValues: [
                    { pricing_item_config_id: 'monthly-config' },
                    { pricing_item_config_id: 'eur-config' },
                    { pricing_item_config_id: 'eur-yearly-config' },
                ],
            });

            expect(getInitialSeatsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'monthly-config', number: '2' },
                { pricing_item_config_id: 'eur-config', number: '4' },
                { pricing_item_config_id: 'eur-yearly-config', number: '6' },
            ]);
        });

        it('should drop everything but the id and the number a seat is priced on', () => {
            const scheduleInfo = createScheduleInfo({
                items: [createItem([createConfig({ id: 'config-1' })])],
                seatsValues: [
                    {
                        pricing_item_config_id: 'config-1',
                        number: '2',
                        start_at: '2024-01-01T00:00:00Z',
                        end_at: '2024-12-31T23:59:59Z',
                    } satisfies ConfiguredMeterValue,
                ],
            });

            expect(getInitialSeatsValues(scheduleInfo)).toEqual([
                { pricing_item_config_id: 'config-1', number: '2' },
            ]);
        });

        it('should return nothing when the schedule lists no seats at all', () => {
            expect(getInitialSeatsValues(undefined)).toBeUndefined();

            expect(
                getInitialSeatsValues(
                    createScheduleInfo({ items: [createItem([createConfig({ id: 'config-1' })])] }),
                ),
            ).toBeUndefined();

            expect(
                getInitialSeatsValues(
                    createScheduleInfo({
                        items: [createItem([createConfig({ id: 'config-1' })])],
                        seatsValues: [],
                    }),
                ),
            ).toBeUndefined();
        });
    });
});
