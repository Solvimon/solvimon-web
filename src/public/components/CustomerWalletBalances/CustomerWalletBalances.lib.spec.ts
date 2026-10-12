import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { reactive } from 'vue';
import {
    getWalletBalanceForTopUpItem,
    getWalletBalancesForSubscriptions,
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
