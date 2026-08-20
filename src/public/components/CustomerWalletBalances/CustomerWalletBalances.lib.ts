import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
} from '@solvimon/solvimon-types';

/**
 * The wallet a top-up belongs to. The rows emit the top-up that was picked but not the wallet it
 * came from, and a rule is saved against the wallet — so it is looked back up by the item's identity.
 */
export const getWalletBalanceForTopUpItem = (
    walletBalances: CustomerWalletBalanceItem[] = [],
    topUpItem?: ChargeOnDemandPricingItem,
): CustomerWalletBalanceItem | undefined => {
    if (!topUpItem?.pricing_item_id) {
        return undefined;
    }

    return walletBalances.find((balance) =>
        (balance.charge_on_demand_pricing_items ?? []).some(
            ({ pricing_item_id }) => pricing_item_id === topUpItem.pricing_item_id,
        ),
    );
};
