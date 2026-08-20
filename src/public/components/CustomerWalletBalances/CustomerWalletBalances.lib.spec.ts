import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
} from '@solvimon/solvimon-types';
import { getWalletBalanceForTopUpItem } from './CustomerWalletBalances.lib';

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

    it('finds nothing for a top-up no wallet offers', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem('prii_unknown'))).toBeUndefined();
    });

    it('finds nothing without a top-up to go on', () => {
        expect(getWalletBalanceForTopUpItem(wallets, topUpItem(undefined))).toBeUndefined();
        expect(getWalletBalanceForTopUpItem(wallets)).toBeUndefined();
        expect(getWalletBalanceForTopUpItem()).toBeUndefined();
    });
});
