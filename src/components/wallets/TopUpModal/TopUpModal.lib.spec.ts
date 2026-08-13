import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';
import { getFlexibleTopUpPricing, getTopUpPricingItems } from './TopUpModal.lib';

const WALLET_TYPE_ID = 'wtyp_1';

const flexibleConfig = {
    object_type: 'PRICING_ITEM_CONFIG',
    id: 'pico_1',
    details: {
        pricing_type: 'FLEXIBLE',
        bands: [
            {
                minimum_amount: { quantity: '5.00', currency: 'EUR' },
                maximum_amount: { quantity: '500.00', currency: 'EUR' },
            },
        ],
    },
    on_demand: true,
    wallet_grants: [
        {
            wallet_type_id: WALLET_TYPE_ID,
            credits_grant: { conversion: { credit_type_id: 'ctyp_1', rate: '10' } },
        },
    ],
};

/** A quantity of the fixture wallet's own credit type, as the lib expresses credit values. */
const creditsOf = (quantity: string) => ({
    credits: {
        quantity,
        credit_type_id: 'ctyp_1',
        credit_type: { unit_name: { singular: 'bitcoin', plural: 'bitcoins' } },
    },
});

const createWalletBalanceItem = ({
    configs = [flexibleConfig],
    unitName = { singular: 'bitcoin', plural: 'bitcoins' },
    balance,
    walletTypeId = WALLET_TYPE_ID,
}: {
    configs?: unknown[];
    unitName?: { singular: string; plural: string } | null;
    /** Overrides the credits balance, e.g. to describe a money based wallet. */
    balance?: unknown;
    /** Null leaves the wallet type out entirely, as the balances endpoint does. */
    walletTypeId?: string | null;
} = {}) =>
    ({
        wallet_id: 'wall_1',
        ...(walletTypeId && { wallet_type_id: walletTypeId }),
        wallet_balance: {
            balance: balance ?? {
                credits: {
                    quantity: '100',
                    credit_type_id: 'ctyp_1',
                    ...(unitName && { credit_type: { unit_name: unitName } }),
                },
            },
        },
        // The real response shape: the item and its configs sit under `pricing_item`, with the ids
        // alongside — not on the entry itself, as the declared `PricingItemConfig[]` implies.
        charge_on_demand_pricing_items: [
            {
                pricing_item_id: 'prii_1',
                pricing_plan_schedule_id: 'ppsc_1',
                pricing_item: { object_type: 'PRICING_ITEM', id: 'prii_1', configs },
            },
        ],
    }) as unknown as CustomerWalletBalanceItem;

describe('getFlexibleTopUpPricing', () => {
    it('reads the bounds, currency and credits conversion of the flexible item', () => {
        expect(getFlexibleTopUpPricing(createWalletBalanceItem())).toEqual({
            pricingItemId: 'prii_1',
            config: {
                minimum_amount: { quantity: '5.00', currency: 'EUR' },
                maximum_amount: { quantity: '500.00', currency: 'EUR' },
            },
            currency: 'EUR',
            creditsConfiguration: {
                conversionRate: '10',
                unitNameSingle: 'bitcoin',
                unitNamePlural: 'bitcoins',
            },
            // A credit based wallet reads its bounds in credits: the money bound times the rate.
            bounds: {
                minimum: creditsOf('50'),
                maximum: creditsOf('5000'),
            },
        });
    });

    it('omits the credits configuration when the item grants no credits', () => {
        const configs = [{ ...flexibleConfig, wallet_grants: undefined }];

        expect(getFlexibleTopUpPricing(createWalletBalanceItem({ configs }))).toEqual({
            pricingItemId: 'prii_1',
            config: {
                minimum_amount: { quantity: '5.00', currency: 'EUR' },
                maximum_amount: { quantity: '500.00', currency: 'EUR' },
            },
            currency: 'EUR',
            // Nothing converts, so the bounds stay in money.
            bounds: {
                minimum: { amount: { quantity: '5.00', currency: 'EUR' } },
                maximum: { amount: { quantity: '500.00', currency: 'EUR' } },
            },
        });
    });

    it('omits the credits configuration for a money based wallet', () => {
        const balance = { amount: { quantity: '100.00', currency: 'EUR' } };

        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ balance }))?.creditsConfiguration,
        ).toBeUndefined();
    });

    it('uses the credits grant when the balance carries no wallet type', () => {
        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ walletTypeId: null }))
                ?.creditsConfiguration,
        ).toEqual({
            conversionRate: '10',
            unitNameSingle: 'bitcoin',
            unitNamePlural: 'bitcoins',
        });
    });

    it('ignores a grant for another wallet type', () => {
        const configs = [
            {
                ...flexibleConfig,
                wallet_grants: [
                    {
                        wallet_type_id: 'wtyp_other',
                        credits_grant: { conversion: { credit_type_id: 'ctyp_2', rate: '3' } },
                    },
                ],
            },
        ];

        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ configs }))?.creditsConfiguration,
        ).toBeUndefined();
    });

    it('keeps the conversion rate when the credit type has no unit name', () => {
        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ unitName: null }))
                ?.creditsConfiguration,
        ).toEqual({ conversionRate: '10' });
    });

    it('ignores pricing items that are not flexible or not on demand', () => {
        const notFlexible = { ...flexibleConfig, details: { pricing_type: 'FIXED', bands: [] } };
        const notOnDemand = { ...flexibleConfig, on_demand: false };

        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ configs: [notFlexible] })),
        ).toBeUndefined();
        expect(
            getFlexibleTopUpPricing(createWalletBalanceItem({ configs: [notOnDemand] })),
        ).toBeUndefined();
    });

    it('returns undefined without a wallet or without on-demand items', () => {
        expect(getFlexibleTopUpPricing(undefined)).toBeUndefined();
        expect(
            getFlexibleTopUpPricing({
                wallet_id: 'wall_1',
                wallet_type_id: WALLET_TYPE_ID,
                wallet_balance: {},
            } as unknown as CustomerWalletBalanceItem),
        ).toBeUndefined();
    });
});

describe('getTopUpPricingItems', () => {
    /**
     * Entries name the pricing item and its schedule, with the item and its configs nested under
     * `pricing_item` — not the flat `PricingItemConfig` the types package declares.
     */
    const createBalanceItem = (entries: unknown[]) =>
        ({
            wallet_id: 'wall_1',
            wallet_balance: {},
            charge_on_demand_pricing_items: entries,
        }) as unknown as CustomerWalletBalanceItem;

    const createEntry = ({
        pricingItemId = 'prii_1',
        scheduleId,
        configs = [flexibleConfig],
    }: {
        pricingItemId?: string | null;
        scheduleId?: string;
        configs?: unknown[] | null;
    } = {}) => ({
        ...(pricingItemId && { pricing_item_id: pricingItemId }),
        ...(scheduleId && { pricing_plan_schedule_id: scheduleId }),
        pricing_item: {
            object_type: 'PRICING_ITEM',
            ...(pricingItemId && { id: pricingItemId }),
            ...(configs && { configs }),
        },
    });

    it('reads the configs nested under pricing_item', () => {
        const result = getTopUpPricingItems(
            createBalanceItem([
                createEntry({ configs: [flexibleConfig, { id: 'pico_2', on_demand: true }] }),
            ]),
        );

        expect(result.map(({ config }) => config.id)).toEqual(['pico_1', 'pico_2']);
    });

    it('carries the item id and the schedule the top-up is charged on', () => {
        const [result] = getTopUpPricingItems(
            createBalanceItem([createEntry({ scheduleId: 'ppsc_1' })]),
        );

        expect(result.pricingItemId).toBe('prii_1');
        expect(result.pricingPlanScheduleId).toBe('ppsc_1');
    });

    it('leaves the schedule out when the entry does not name one', () => {
        const [result] = getTopUpPricingItems(createBalanceItem([createEntry()]));

        expect(result.pricingPlanScheduleId).toBeUndefined();
    });

    it('falls back to the nested item id when the entry omits it', () => {
        const [result] = getTopUpPricingItems(
            createBalanceItem([
                {
                    pricing_item: { id: 'prii_nested', configs: [flexibleConfig] },
                },
            ]),
        );

        expect(result.pricingItemId).toBe('prii_nested');
    });

    it('keeps configs that do not carry the on_demand flag', () => {
        // The field they arrived in already scopes them to on-demand.
        const result = getTopUpPricingItems(
            createBalanceItem([
                createEntry({ configs: [{ id: 'pico_a' }, { id: 'pico_b', on_demand: false }] }),
            ]),
        );

        expect(result.map(({ config }) => config.id)).toEqual(['pico_a', 'pico_b']);
    });

    it('skips entries with no configs, no item, or no id', () => {
        const result = getTopUpPricingItems(
            createBalanceItem([
                createEntry({ pricingItemId: 'prii_no_configs', configs: null }),
                { pricing_item_id: 'prii_no_item' },
                createEntry({ pricingItemId: null }),
                createEntry({ pricingItemId: 'prii_ok' }),
            ]),
        );

        expect(result.map(({ pricingItemId }) => pricingItemId)).toEqual(['prii_ok']);
    });

    it('returns nothing without a wallet balance item', () => {
        expect(getTopUpPricingItems()).toEqual([]);
    });
});

describe('getTopUpPricingItems pricing kinds', () => {
    const createBalanceItem = (configs: unknown[]) =>
        ({
            wallet_id: 'wall_1',
            wallet_balance: {},
            charge_on_demand_pricing_items: [
                {
                    pricing_item_id: 'prii_1',
                    pricing_plan_schedule_id: 'ppsc_1',
                    pricing_item: { id: 'prii_1', configs },
                },
            ],
        }) as unknown as CustomerWalletBalanceItem;

    const fixedConfig = {
        id: 'pico_fixed',
        on_demand: true,
        details: {
            pricing_type: 'FIXED',
            bands: [{ fixed_amount: { quantity: '10.00', currency: 'EUR' } }],
        },
    };

    it('resolves the amount a fixed top-up costs', () => {
        const [result] = getTopUpPricingItems(createBalanceItem([fixedConfig]));

        expect(result.fixedPricing).toEqual({
            amount: { quantity: '10.00', currency: 'EUR' },
            // The wallet in this fixture holds no credits, so it reads as money.
            value: { amount: { quantity: '10.00', currency: 'EUR' } },
        });
        expect(result.flexiblePricing).toBeUndefined();
    });

    it('resolves the bounds a flexible top-up allows', () => {
        const [result] = getTopUpPricingItems(createBalanceItem([flexibleConfig]));

        expect(result.flexiblePricing?.config).toEqual({
            minimum_amount: { quantity: '5.00', currency: 'EUR' },
            maximum_amount: { quantity: '500.00', currency: 'EUR' },
        });
        expect(result.fixedPricing).toBeUndefined();
    });

    it('marks a fixed pricing with no amount as not chargeable', () => {
        const [result] = getTopUpPricingItems(
            createBalanceItem([
                {
                    id: 'pico_fixed',
                    on_demand: true,
                    details: { pricing_type: 'FIXED', bands: [] },
                },
            ]),
        );

        expect(result.fixedPricing).toBeUndefined();
        expect(result.flexiblePricing).toBeUndefined();
    });

    it('leaves both kinds unset for a pricing type it does not handle', () => {
        const [result] = getTopUpPricingItems(
            createBalanceItem([
                { id: 'pico_tiered', on_demand: true, details: { pricing_type: 'TIERED' } },
            ]),
        );

        expect(result.fixedPricing).toBeUndefined();
        expect(result.flexiblePricing).toBeUndefined();
    });

    it('keeps both kinds distinguishable when a wallet offers each', () => {
        const results = getTopUpPricingItems(createBalanceItem([flexibleConfig, fixedConfig]));

        expect(results.map(({ flexiblePricing }) => !!flexiblePricing)).toEqual([true, false]);
        expect(results.map(({ fixedPricing }) => !!fixedPricing)).toEqual([false, true]);
    });
});
