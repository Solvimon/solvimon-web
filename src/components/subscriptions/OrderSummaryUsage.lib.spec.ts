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
            groupsOf(scheduleInfo)[0]?.prices.map(({ name, rate, tiers }) => ({
                name,
                rate,
                tiers,
            })),
        ).toEqual([
            {
                name: 'Cards',
                rate: undefined,
                tiers: [
                    { range: '0 - 20,000', rate: '€0.05 / transaction' },
                    { range: '20,000+', rate: '€0.04 / transaction' },
                ],
            },
            {
                name: 'Payouts',
                rate: undefined,
                tiers: [
                    { range: '0 - 100', rate: '€10.00' },
                    { range: '100+', rate: '€15.00' },
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
                usagePricing({
                    id: 'pri_block',
                    name: 'Blocks',
                    bands: [{ amount: eur('1.00'), block_size: { number: '1000' } }],
                }),
            ]),
        ]);

        expect(ratesOf(scheduleInfo)).toEqual([
            ['Network fees', undefined],
            ['Blocks', undefined],
        ]);
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

    it('shows no rate for a band priced per block, capped, or with a fixed fee on top', () => {
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
            groupsOf(scheduleInfo)[0]?.prices.map(({ name, rate, tiers }) => ({
                name,
                rate,
                rates: tiers?.map((tier) => tier.rate),
            })),
        ).toEqual([
            { name: 'Cards', rate: undefined, rates: [undefined, undefined, undefined] },
            { name: 'Payouts', rate: undefined, rates: undefined },
        ]);
    });

    it('shows no rate for a price with a config per condition', () => {
        const pricing = usagePricing({
            id: 'pri_cards',
            name: 'Cards',
            bands: [{ percentage: '1.4' }],
        });
        pricing.items[0]!.configs.push({
            id: 'pri_cards_amex',
            details: { pricing_type: 'FLAT', bands: [{ percentage: '2.9' }] },
        });

        expect(ratesOf(scheduleInfoOf([category('prca_payments', 'Payments', [pricing])]))).toEqual(
            [['Cards', undefined]],
        );
    });
});
