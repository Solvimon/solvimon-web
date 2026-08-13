import type { PricingPlanScheduleInfoExpanded } from '@solvimon/solvimon-types';
import { getEnabledPricingsEntries } from './EnabledPricingsList.lib';

/**
 * A schedule info carrying one pricing group. Entries name the pricing, the amount band it is
 * priced by, and whether the schedule has it enabled.
 */
const createScheduleInfo = ({
    enabledPricingIds = ['pri_credits_1000'],
    groupName = 'Credit packs',
    pricings = [
        {
            id: 'pri_credits_1000',
            name: '1.000 credits',
            items: [
                {
                    id: 'pit_1',
                    configs: [
                        {
                            details: {
                                bands: [{ amount: { currency: 'EUR', quantity: '100' } }],
                                pricing_period: { type: 'MONTH', value: 1 },
                            },
                        },
                    ],
                },
            ],
        },
    ],
}: {
    enabledPricingIds?: string[];
    groupName?: string;
    pricings?: unknown[];
} = {}) =>
    ({
        pricing_plan_schedule: {
            id: 'ppsc_1',
            enabled_pricings: enabledPricingIds.map((pricing_id) => ({ pricing_id })),
        },
        pricing_plan_version: {
            pricing_categories: [
                {
                    id: 'pca_1',
                    pricing_groups: [{ id: 'pgr_1', name: groupName, pricings }],
                },
            ],
        },
    }) as unknown as PricingPlanScheduleInfoExpanded;

describe('getEnabledPricingsEntries', () => {
    it('resolves an enabled pricing against the group it was chosen from', () => {
        const [entry] = getEnabledPricingsEntries(createScheduleInfo());

        expect(entry).toEqual({
            pricingId: 'pri_credits_1000',
            pricingGroupId: 'pgr_1',
            groupName: 'Credit packs',
            name: '1.000 credits',
            amount: { currency: 'EUR', quantity: '100' },
            billingPeriod: { type: 'MONTH', value: 1 },
        });
    });

    it('leaves out pricings the schedule does not have enabled', () => {
        const entries = getEnabledPricingsEntries(
            createScheduleInfo({
                enabledPricingIds: ['pri_credits_1000'],
                pricings: [
                    { id: 'pri_credits_1000', name: '1.000 credits' },
                    { id: 'pri_credits_5000', name: '5.000 credits' },
                ],
            }),
        );

        expect(entries.map(({ pricingId }) => pricingId)).toEqual(['pri_credits_1000']);
    });

    it('returns nothing when the schedule has no enabled pricings', () => {
        expect(getEnabledPricingsEntries(createScheduleInfo({ enabledPricingIds: [] }))).toEqual(
            [],
        );
    });

    it('returns nothing when the version has no pricing groups', () => {
        const scheduleInfo = {
            pricing_plan_schedule: { enabled_pricings: [{ pricing_id: 'pri_1' }] },
            pricing_plan_version: { pricing_categories: [{ id: 'pca_1' }] },
        } as unknown as PricingPlanScheduleInfoExpanded;

        expect(getEnabledPricingsEntries(scheduleInfo)).toEqual([]);
    });

    it('names the pricing after its first product when it has no name of its own', () => {
        const [entry] = getEnabledPricingsEntries(
            createScheduleInfo({
                pricings: [{ id: 'pri_credits_1000', products: [{ name: 'Credit pack, small' }] }],
            }),
        );

        expect(entry.name).toBe('Credit pack, small');
    });

    it('falls back to the group name when neither the pricing nor its product is named', () => {
        const [entry] = getEnabledPricingsEntries(
            createScheduleInfo({ pricings: [{ id: 'pri_credits_1000' }] }),
        );

        expect(entry.name).toBe('Credit packs');
    });

    it('reads a fixed amount when the band has no plain amount', () => {
        const [entry] = getEnabledPricingsEntries(
            createScheduleInfo({
                pricings: [
                    {
                        id: 'pri_credits_1000',
                        name: '1.000 credits',
                        items: [
                            {
                                configs: [
                                    {
                                        details: {
                                            bands: [
                                                {
                                                    fixed_amount: {
                                                        currency: 'EUR',
                                                        quantity: '75',
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        );

        expect(entry.amount).toEqual({ currency: 'EUR', quantity: '75' });
    });

    it('leaves the price out when the pricing has no band to read it from', () => {
        const [entry] = getEnabledPricingsEntries(
            createScheduleInfo({
                pricings: [{ id: 'pri_credits_1000', name: 'Metered credits', items: [{}] }],
            }),
        );

        expect(entry.amount).toBeUndefined();
        expect(entry.billingPeriod).toBeUndefined();
    });

    it('lists an enabled pricing from every group', () => {
        const scheduleInfo = {
            pricing_plan_schedule: {
                enabled_pricings: [{ pricing_id: 'pri_credits' }, { pricing_id: 'pri_support' }],
            },
            pricing_plan_version: {
                pricing_categories: [
                    {
                        pricing_groups: [
                            {
                                id: 'pgr_credits',
                                name: 'Credit packs',
                                pricings: [{ id: 'pri_credits', name: '1.000 credits' }],
                            },
                        ],
                    },
                    {
                        pricing_groups: [
                            {
                                id: 'pgr_support',
                                name: 'Support',
                                pricings: [{ id: 'pri_support', name: 'Premium support' }],
                            },
                        ],
                    },
                ],
            },
        } as unknown as PricingPlanScheduleInfoExpanded;

        expect(getEnabledPricingsEntries(scheduleInfo).map(({ name }) => name)).toEqual([
            '1.000 credits',
            'Premium support',
        ]);
    });
});
