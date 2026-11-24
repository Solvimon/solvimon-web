import type { Band, PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import { getUsagePriceGroups } from './OrderSummaryUsage.lib';
import { mockUseIntl } from '@/test-utils/useIntlMock';

const intl = {
    $t: mockUseIntl().$t,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat('en-US', options).format(value),
};

const eur = (quantity: string) => ({ quantity, currency: 'EUR' });

const usagePricing = ({
    id,
    name,
    pricingType = 'FLAT',
    bands,
    unit = 'transaction',
    modelType = 'USAGE_BASED',
    ...rest
}: {
    id: string;
    name: string;
    pricingType?: string;
    bands: Band[];
    unit?: string;
    modelType?: string;
    product_type?: string;
    pricing_group_id?: string;
}) => ({
    id,
    ...rest,
    items: [
        {
            id: `${id}_item`,
            product_items: [
                {
                    name,
                    model_type: modelType,
                    ...(unit ? { unit_name: { singular: unit, plural: `${unit}s` } } : {}),
                },
            ],
            configs: [{ id: `${id}_config`, details: { pricing_type: pricingType, bands } }],
        },
    ],
});

const category = (
    id: string,
    name: string,
    pricings: unknown[],
    pricingGroups: unknown[] = [],
) => ({
    product_category_id: id,
    product_category: { id, name },
    pricings,
    pricing_groups: pricingGroups,
});

const scheduleInfoOf = (categories: unknown[], overridePricings: unknown[] = []) =>
    ({
        pricing_plan_version: { pricing_categories: categories },
        pricing_plan_schedule: { override_pricings: overridePricings },
    }) as unknown as PricingPlanScheduleInfoExpanded;

const groupsOf = (scheduleInfo: PricingPlanScheduleInfoExpanded, enabledPricingIds?: string[]) =>
    getUsagePriceGroups({
        scheduleInfo,
        enabledPricingIds,
        currency: 'EUR',
        billingPeriod: { type: 'MONTH', value: 1 },
        intl,
    });

const ratesOf = (scheduleInfo: PricingPlanScheduleInfoExpanded) =>
    groupsOf(scheduleInfo).flatMap((group) => group.prices.map(({ name, rate }) => [name, rate]));

describe('getUsagePriceGroups', () => {
    it('groups the usage prices by pricing category and leaves other prices out', () => {
        const groups = groupsOf(
            scheduleInfoOf([
                category('prca_payments', 'Payments', [
                    usagePricing({
                        id: 'pri_cards',
                        name: 'Cards',
                        bands: [{ amount: eur('0.05') }],
                    }),
                    usagePricing({
                        id: 'pri_fee',
                        name: 'Platform fee',
                        modelType: 'RECURRING',
                        bands: [{ amount: eur('10.00') }],
                    }),
                ]),
                category('prca_payouts', 'Payouts', [
                    usagePricing({
                        id: 'pri_payouts',
                        name: 'Payouts',
                        bands: [{ amount: eur('0.10') }],
                    }),
                ]),
            ]),
        );

        expect(groups).toEqual([
            {
                name: 'Payments',
                prices: [
                    {
                        name: 'Cards',
                        billingPeriod: { type: 'MONTH', value: 1 },
                        rate: '€0.05 / transaction',
                    },
                ],
            },
            {
                name: 'Payouts',
                prices: [
                    {
                        name: 'Payouts',
                        billingPeriod: { type: 'MONTH', value: 1 },
                        rate: '€0.10 / transaction',
                    },
                ],
            },
        ]);
    });

    it('leaves out an add-on or group member unless it is enabled', () => {
        const scheduleInfo = scheduleInfoOf([
            category(
                'prca_payments',
                'Payments',
                [
                    usagePricing({
                        id: 'pri_addon',
                        name: 'Fraud checks',
                        product_type: 'ADDON',
                        bands: [{ amount: eur('0.02') }],
                    }),
                ],
                [
                    {
                        id: 'prgr_1',
                        pricings: [
                            usagePricing({
                                id: 'pri_member',
                                name: 'Instant payouts',
                                bands: [{ amount: eur('0.25') }],
                            }),
                        ],
                    },
                ],
            ),
        ]);

        const names = (enabled: string[]) =>
            groupsOf(scheduleInfo, enabled).flatMap((group) => group.prices.map((p) => p.name));

        expect(names([])).toEqual([]);
        expect(names(['pri_addon', 'pri_member'])).toEqual(['Fraud checks', 'Instant payouts']);
    });

    it('shows a customized price at its customized rate', () => {
        const scheduleInfo = scheduleInfoOf(
            [
                category('prca_payments', 'Payments', [
                    usagePricing({
                        id: 'pri_cards',
                        name: 'Cards',
                        bands: [{ amount: eur('0.05') }],
                    }),
                ]),
            ],
            [
                {
                    id: 'pri_cards_custom',
                    original_pricing_id: 'pri_cards',
                    override: 'SPECIFIC',
                    items: [
                        {
                            id: 'pri_cards_item_custom',
                            original_pricing_item_id: 'pri_cards_item',
                            override: 'SPECIFIC',
                            configs: [
                                {
                                    id: 'pico_custom',
                                    original_pricing_item_config_id: 'pri_cards_config',
                                    details: {
                                        pricing_type: 'FLAT',
                                        bands: [{ amount: eur('0.03') }],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        );

        expect(ratesOf(scheduleInfo)).toEqual([['Cards', '€0.03 / transaction']]);
    });

    it('states each shape of a flat rate', () => {
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({ id: 'pri_1', name: 'Per unit', bands: [{ amount: eur('0.05') }] }),
                usagePricing({ id: 'pri_2', name: 'Share', bands: [{ percentage: '1.19' }] }),
                usagePricing({
                    id: 'pri_3',
                    name: 'Both',
                    bands: [{ percentage: '1.4', amount: eur('0.25') }],
                }),
                usagePricing({
                    id: 'pri_4',
                    name: 'No unit',
                    unit: '',
                    bands: [{ amount: eur('0.01') }],
                }),
                usagePricing({
                    id: 'pri_5',
                    name: 'No unit share',
                    unit: '',
                    bands: [{ percentage: '2' }],
                }),
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([
            ['Per unit', '€0.05 / transaction'],
            ['Share', '1.19% of transaction value'],
            ['Both', '1.4% + €0.25 / transaction'],
            ['No unit', '€0.01 / unit'],
            ['No unit share', '2%'],
        ]);
    });

    it('lists a row per band of a tiered price, the last one open-ended', () => {
        const bands: Band[] = [
            { amount: eur('0.05'), tier_top_bound: { number: '20000' } },
            { amount: eur('0.04') },
        ];
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({ id: 'pri_tiered', name: 'Cards', pricingType: 'TIERED', bands }),
                usagePricing({
                    id: 'pri_steps',
                    name: 'Payouts',
                    pricingType: 'STAIR_STEP',
                    bands: [
                        { fixed_amount: eur('10.00'), tier_top_bound: { number: '100' } },
                        { fixed_amount: eur('15.00') },
                    ],
                }),
            ]),
        ]);

        expect(
            groupsOf(scheduleInfo)[0]?.prices.map(({ name, rate, rows }) => ({
                name,
                rate,
                rows,
            })),
        ).toEqual([
            {
                name: 'Cards',
                rate: undefined,
                rows: [
                    { label: '0 - 20,000', rate: '€0.05 / transaction' },
                    { label: '20,000+', rate: '€0.04 / transaction' },
                ],
            },
            {
                name: 'Payouts',
                rate: undefined,
                rows: [
                    { label: '0 - 100', rate: '€10.00' },
                    { label: '100+', rate: '€15.00' },
                ],
            },
        ]);
    });

    it('skips a price of type none and shows an unsupported type without a rate', () => {
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({ id: 'pri_none', name: 'Free', pricingType: 'NONE', bands: [] }),
                usagePricing({
                    id: 'pri_pass',
                    name: 'Network fees',
                    pricingType: 'PASS_THROUGH',
                    bands: [{ percentage: '100' }],
                }),
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([['Network fees', undefined]]);
    });

    it('counts a customized add-on enabled under its original id', () => {
        const scheduleInfo = scheduleInfoOf(
            [
                category('prca_payments', 'Payments', [
                    usagePricing({
                        id: 'pri_fraud',
                        name: 'Fraud checks',
                        product_type: 'ADDON',
                        bands: [{ amount: eur('0.02') }],
                    }),
                ]),
            ],
            [
                {
                    id: 'pri_fraud_custom',
                    original_pricing_id: 'pri_fraud',
                    override: 'SPECIFIC',
                    items: [],
                },
            ],
        );

        expect(
            groupsOf(scheduleInfo, ['pri_fraud']).flatMap((group) =>
                group.prices.map(({ name, rate }) => [name, rate]),
            ),
        ).toEqual([['Fraud checks', '€0.02 / transaction']]);
    });

    it('lists a pricing once when a category and its group both hold it', () => {
        const member = usagePricing({
            id: 'pri_member',
            name: 'Instant payouts',
            pricing_group_id: 'prgr_1',
            bands: [{ amount: eur('0.25') }],
        });
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [member], [{ id: 'prgr_1', pricings: [member] }]),
        ]);

        expect(
            groupsOf(scheduleInfo, ['pri_member']).flatMap((group) =>
                group.prices.map(({ name }) => name),
            ),
        ).toEqual(['Instant payouts']);
    });

    it('leaves out a zero percentage next to an amount', () => {
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({
                    id: 'pri_1',
                    name: 'Refunds',
                    bands: [{ percentage: '0', amount: eur('0.25') }],
                }),
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([['Refunds', '€0.25 / transaction']]);
    });

    it('leaves out a zero amount next to a percentage', () => {
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({
                    id: 'pri_1',
                    name: 'Cards',
                    bands: [{ percentage: '1.4', amount: eur('0') }],
                }),
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([['Cards', '1.4% of transaction value']]);
    });

    it('states a rate per block of units', () => {
        const singularOnly = usagePricing({
            id: 'pri_singular',
            name: 'Singular only',
            bands: [{ amount: eur('0.02'), block_size: { number: '1000000' } }],
        });
        singularOnly.items[0]!.product_items[0]!.unit_name = { singular: 'token' } as {
            singular: string;
            plural: string;
        };
        const scheduleInfo = scheduleInfoOf([
            category('prca_tokens', 'Tokens', [
                usagePricing({
                    id: 'pri_input',
                    name: 'Input tokens',
                    unit: 'token',
                    bands: [{ amount: eur('0.02'), block_size: { number: '1000000' } }],
                }),
                usagePricing({
                    id: 'pri_one',
                    name: 'Block of one',
                    bands: [{ amount: eur('0.05'), block_size: { number: '1' } }],
                }),
                usagePricing({
                    id: 'pri_no_unit',
                    name: 'No unit',
                    unit: '',
                    bands: [{ amount: eur('1.00'), block_size: { number: '1000' } }],
                }),
                usagePricing({
                    id: 'pri_share',
                    name: 'Share per block',
                    bands: [{ percentage: '1', block_size: { number: '1000' } }],
                }),
                usagePricing({
                    id: 'pri_amount_block',
                    name: 'Per amount block',
                    bands: [{ amount: eur('2.00'), block_size: { amount: eur('1000') } }],
                }),
                usagePricing({
                    id: 'pri_short',
                    name: 'Short block',
                    unit: 'token',
                    bands: [{ amount: eur('2.00'), block_size: { number: '12500' } }],
                }),
                usagePricing({
                    id: 'pri_long',
                    name: 'Long block',
                    unit: 'token',
                    bands: [{ amount: eur('2.00'), block_size: { number: '1234567' } }],
                }),
                singularOnly,
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([
            ['Input tokens', '€0.02 / 1M tokens'],
            ['Block of one', '€0.05 / transaction'],
            ['No unit', '€1.00 / 1K units'],
            ['Share per block', undefined],
            ['Per amount block', undefined],
            ['Short block', '€2.00 / 12.5K tokens'],
            ['Long block', '€2.00 / 1,234,567 tokens'],
            ['Singular only', '€0.02 / 1M token'],
        ]);
    });

    it('shows no rate for a band capped or with a fixed fee on top', () => {
        const scheduleInfo = scheduleInfoOf([
            category('prca_payments', 'Payments', [
                usagePricing({
                    id: 'pri_tiered',
                    name: 'Cards',
                    pricingType: 'TIERED',
                    bands: [
                        {
                            amount: eur('0'),
                            fixed_amount: eur('100.00'),
                            tier_top_bound: { number: '10' },
                        },
                        {
                            amount: eur('5.00'),
                            block_size: { number: '1000' },
                            tier_top_bound: { number: '20' },
                        },
                        { amount: eur('0.01'), maximum_amount: eur('50.00') },
                    ],
                }),
                usagePricing({
                    id: 'pri_flat',
                    name: 'Payouts',
                    bands: [{ amount: eur('0.10'), fixed_amount: eur('1.00') }],
                }),
            ]),
        ]);

        expect(
            groupsOf(scheduleInfo)[0]?.prices.map(({ name, rate, rows }) => ({
                name,
                rate,
                rates: rows?.map((row) => row.rate),
            })),
        ).toEqual([
            {
                name: 'Cards',
                rate: undefined,
                rates: [undefined, '€5.00 / 1K transactions', undefined],
            },
            { name: 'Payouts', rate: undefined, rates: undefined },
        ]);
    });

    describe('a price with a config per condition', () => {
        const condition = (value: string, comparator = 'EQUALS') => ({
            meter_properties: [{ id: 'metp_capacity', value, comparator }],
        });
        const conditionalPricing = (configs: unknown[]) => {
            const pricing = usagePricing({ id: 'pri_gpu', name: 'B300 usage', bands: [] });
            pricing.items[0]!.configs = configs as (typeof pricing.items)[0]['configs'];
            return scheduleInfoOf([category('prca_compute', 'Compute', [pricing])]);
        };
        const flat = (id: string, order: number, amount: string, conditions: unknown) => ({
            id,
            order,
            conditions,
            details: { pricing_type: 'FLAT', bands: [{ amount: eur(amount) }] },
        });
        const pricesOf = (scheduleInfo: PricingPlanScheduleInfoExpanded) =>
            groupsOf(scheduleInfo)[0]?.prices.map(({ name, rate, rows }) => ({ name, rate, rows }));

        it('lists a row per condition value, in the configs order', () => {
            expect(
                pricesOf(
                    conditionalPricing([
                        flat('spot', 2, '6.39', condition('spot')),
                        flat('on_demand', 1, '12.79', condition('on_demand')),
                    ]),
                ),
            ).toEqual([
                {
                    name: 'B300 usage',
                    rate: undefined,
                    rows: [
                        { label: 'on_demand', rate: '€12.79 / transaction' },
                        { label: 'spot', rate: '€6.39 / transaction' },
                    ],
                },
            ]);
        });

        it('labels a row by the condition name when it has one', () => {
            expect(
                pricesOf(
                    conditionalPricing([
                        flat('a', 1, '12.79', { ...condition('on_demand'), name: 'On demand' }),
                        flat('b', 2, '6.39', { ...condition('spot'), name: 'Spot' }),
                    ]),
                )?.[0]?.rows?.map((row) => row.label),
            ).toEqual(['On demand', 'Spot']);
        });

        it('labels a row without conditions as the other case', () => {
            expect(
                pricesOf(
                    conditionalPricing([
                        flat('spot', 1, '6.39', condition('spot')),
                        flat('rest', 2, '12.79', undefined),
                    ]),
                )?.[0]?.rows,
            ).toEqual([
                { label: 'spot', rate: '€6.39 / transaction' },
                { label: 'Other', rate: '€12.79 / transaction' },
            ]);
        });

        it('shows the name alone when its rows would not say what each one matches', () => {
            const onModel = {
                meter_properties: [{ id: 'metp_model', value: 'B300', comparator: 'EQUALS' }],
            };
            const twoProperties = {
                meter_properties: [
                    { id: 'metp_capacity', value: 'spot', comparator: 'EQUALS' },
                    { id: 'metp_model', value: 'B300', comparator: 'EQUALS' },
                ],
            };
            const tiered = {
                ...flat('b', 2, '6.39', condition('spot')),
                details: {
                    pricing_type: 'TIERED',
                    bands: [
                        { amount: eur('1'), tier_top_bound: { number: '10' } },
                        { amount: eur('2') },
                    ],
                },
            };
            const nested = { ...condition('spot'), configs: [flat('n', 1, '1', undefined)] };

            [
                [
                    flat('a', 1, '12.79', condition('on_demand')),
                    flat('b', 2, '6.39', condition('spot', 'NOT_EQUALS')),
                ],
                [
                    flat('a', 1, '12.79', condition('on_demand')),
                    flat('b', 2, '6.39', twoProperties),
                ],
                [flat('a', 1, '12.79', condition('on_demand')), tiered],
                [flat('a', 1, '12.79', condition('on_demand')), flat('b', 2, '6.39', nested)],
                [flat('a', 1, '12.79', condition('on_demand')), flat('b', 2, '6.39', onModel)],
                [
                    flat('a', 1, '12.79', condition('on_demand')),
                    flat('b', 2, '6.39', undefined),
                    flat('c', 3, '5.00', undefined),
                ],
            ].forEach((configs) => {
                expect(pricesOf(conditionalPricing(configs))).toEqual([
                    { name: 'B300 usage', rate: undefined, rows: undefined },
                ]);
            });
        });
    });
});
