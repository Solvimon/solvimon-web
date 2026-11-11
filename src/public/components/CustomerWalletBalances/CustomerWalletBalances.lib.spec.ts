import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
    OnDemandPricingItemsResponse,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { reactive } from 'vue';
import {
    getWalletBalanceForTopUpItem,
    getWalletBalancesForSubscriptions,
    withTopUpWalletsFromPlan,
} from './CustomerWalletBalances.lib';

const walletWith = (walletId: string, pricingItemIds: string[]) =>
    ({
        wallet_id: walletId,
        charge_on_demand_pricing_items: pricingItemIds.map((pricing_item_id) => ({
            pricing_item_id,
            pricing_plan_schedule_id: 'ppsc_1',
        })),
    }) as unknown as CustomerWalletBalanceItem;

const topUpItem = (pricingItemId?: string) =>
    ({ pricing_item_id: pricingItemId }) as ChargeOnDemandPricingItem;

describe('getWalletBalanceForTopUpItem', () => {
    const wallets = [walletWith('wall_1', ['prii_a']), walletWith('wall_2', ['prii_b', 'prii_c'])];

    it('finds the wallet the top-up belongs to', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem('prii_c'))?.wallet_id).toBe(
            'wall_2',
        );
    });

    it('does not settle for the first wallet', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem('prii_b'))?.wallet_id).toBe(
            'wall_2',
        );
    });

    it('finds the wallet whose row asked, where several wallets offer the same item', () => {
        const shared = [
            walletWith('wall_1', ['prii_shared']),
            walletWith('wall_2', ['prii_shared']),
        ];
        const [, second] = shared;

        expect(
            getWalletBalanceForTopUpItem(shared, second.charge_on_demand_pricing_items?.[0])
                ?.wallet_id,
        ).toBe('wall_2');
    });

    it('recognises the row it came from through a reactive wrapper', () => {
        const shared = reactive([
            walletWith('wall_1', ['prii_shared']),
            walletWith('wall_2', ['prii_shared']),
        ]) as CustomerWalletBalanceItem[];

        expect(
            getWalletBalanceForTopUpItem(shared, shared[1].charge_on_demand_pricing_items?.[0])
                ?.wallet_id,
        ).toBe('wall_2');
    });

    it('finds nothing for a top-up no wallet offers', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem('prii_unknown'))).toBeUndefined();
    });

    it('finds nothing without a top-up to go on', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem(undefined))).toBeUndefined();
        expect(getWalletBalanceForTopUpItem(wallets)).toBeUndefined();
        expect(getWalletBalanceForTopUpItem()).toBeUndefined();
    });
});

describe('getWalletBalancesForSubscriptions', () => {
    const withSchedules = (walletId: string, scheduleIds: string[]) =>
        ({
            wallet_id: walletId,
            charge_on_demand_pricing_items: scheduleIds.map((pricing_plan_schedule_id) => ({
                pricing_item_id: `prii_${pricing_plan_schedule_id}`,
                pricing_plan_schedule_id,
            })),
        }) as unknown as CustomerWalletBalanceItem;

    const subscriptionOn = (scheduleId: string) =>
        ({
            id: 'ppsu_1',
            pricing_plan_schedule_infos: [{ id: scheduleId }],
        }) as unknown as PricingPlanSubscriptionExpanded;

    const scheduleIdsOf = (balances: CustomerWalletBalanceItem[]) =>
        balances.map(({ charge_on_demand_pricing_items }) =>
            (charge_on_demand_pricing_items ?? []).map(
                ({ pricing_plan_schedule_id }) => pricing_plan_schedule_id,
            ),
        );

    it('keeps only the top-ups billed on the subscriptions given', () => {
        const balances = [withSchedules('wall_1', ['ppsc_mine', 'ppsc_other'])];

        expect(
            scheduleIdsOf(
                getWalletBalancesForSubscriptions(balances, [subscriptionOn('ppsc_mine')]),
            ),
        ).toEqual([['ppsc_mine']]);
    });

    it('leaves a wallet another subscription tops up with nothing to offer', () => {
        const balances = [withSchedules('wall_1', ['ppsc_other'])];

        expect(
            scheduleIdsOf(
                getWalletBalancesForSubscriptions(balances, [subscriptionOn('ppsc_mine')]),
            ),
        ).toEqual([[]]);
    });

    it('leaves the balances alone when no subscriptions are given', () => {
        const balances = [withSchedules('wall_1', ['ppsc_other'])];

        expect(getWalletBalancesForSubscriptions(balances, undefined)).toBe(balances);
        expect(getWalletBalancesForSubscriptions(balances, [])).toBe(balances);
    });
});

describe('withTopUpWalletsFromPlan', () => {
    const planItem = (
        id: string,
        { pricingType = 'FLEXIBLE', walletTypeId = 'wtyp_1', creditTypeId = '' } = {},
    ) => ({
        id,
        configs: [
            {
                on_demand: true,
                details: {
                    pricing_type: pricingType,
                    bands: [{ minimum_amount: { quantity: '10', currency: 'EUR' } }],
                },
                wallet_grants: [
                    {
                        wallet_type_id: walletTypeId,
                        ...(creditTypeId && {
                            credits_grant: {
                                conversion: { credit_type_id: creditTypeId, rate: '10' },
                            },
                        }),
                    },
                ],
            },
        ],
    });

    const plan = (...items: ReturnType<typeof planItem>[]) =>
        ({
            pricing_plan_schedule_id: 'ppsc_1',
            pricing_categories: [{ pricings: [{ items }] }],
        }) as unknown as OnDemandPricingItemsResponse;

    it('offers a top-up the plan sells for a wallet the customer does not have yet', () => {
        const [row] = withTopUpWalletsFromPlan([], plan(planItem('prii_flex')));

        expect(row).toMatchObject({
            wallet_id: '',
            wallet_balance: { open_balance: { amount: { quantity: '0', currency: 'EUR' } } },
            charge_on_demand_pricing_items: [
                { pricing_item_id: 'prii_flex', pricing_plan_schedule_id: 'ppsc_1' },
            ],
        });
    });

    it('starts a credit wallet at zero of the credits the top-up converts into', () => {
        const [row] = withTopUpWalletsFromPlan(
            [],
            plan(planItem('prii_flex', { creditTypeId: 'ctyp_1' })),
        );

        expect(row.wallet_balance.balance).toEqual({
            credits: { quantity: '0', credit_type_id: 'ctyp_1' },
        });
    });

    it('offers nothing new for a fixed-price item', () => {
        expect(
            withTopUpWalletsFromPlan([], plan(planItem('prii_fixed', { pricingType: 'FIXED' }))),
        ).toEqual([]);
    });

    it('adds nothing where a wallet already offers the top-up', () => {
        const wallets = [walletWith('wall_1', ['prii_flex'])];

        expect(withTopUpWalletsFromPlan(wallets, plan(planItem('prii_flex')))).toEqual(wallets);
    });

    it('adds nothing where the customer already has a wallet of the granted type', () => {
        const wallets = [
            { ...walletWith('wall_1', []), wallet: { wallet_type_id: 'wtyp_1' } },
        ] as CustomerWalletBalanceItem[];

        expect(withTopUpWalletsFromPlan(wallets, plan(planItem('prii_flex')))).toEqual(wallets);
    });

    it('gathers the top-ups granting to one wallet type in one row', () => {
        const rows = withTopUpWalletsFromPlan([], plan(planItem('prii_a'), planItem('prii_b')));

        expect(rows).toHaveLength(1);
        expect(rows[0].charge_on_demand_pricing_items).toHaveLength(2);
    });

    it('leaves the balances as they are before the plan has loaded', () => {
        const wallets = [walletWith('wall_1', ['prii_a'])];

        expect(withTopUpWalletsFromPlan(wallets, undefined)).toEqual(wallets);
    });
});
