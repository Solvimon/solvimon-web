import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
    PricingPlanSubscriptionExpanded,
} from '@solvimon/solvimon-types';
import { toRaw } from 'vue';

/**
 * The wallet a top-up belongs to. The rows emit the top-up that was picked but not the wallet it
 * came from, and a rule is saved against the wallet — so it is looked back up.
 *
 * One pricing item can grant to several wallet types, and then every one of those wallets lists it.
 * The rows hand back the entry of the wallet they render, so that entry is matched first; the id is
 * only a fallback, for an entry that did not come from these balances.
 */
export const getWalletBalanceForTopUpItem = (
    walletBalances: CustomerWalletBalanceItem[] = [],
    topUpItem?: ChargeOnDemandPricingItem,
): CustomerWalletBalanceItem | undefined => {
    if (!topUpItem?.pricing_item_id) {
        return undefined;
    }

    const entries = (balance: CustomerWalletBalanceItem) =>
        balance.charge_on_demand_pricing_items ?? [];
    const rawItem = toRaw(topUpItem);

    return (
        walletBalances.find((balance) =>
            entries(balance).some((entry) => toRaw(entry) === rawItem),
        ) ??
        walletBalances.find((balance) =>
            entries(balance).some(
                ({ pricing_item_id }) => pricing_item_id === topUpItem.pricing_item_id,
            ),
        )
    );
};

/**
 * The balances with only the top-ups billed on the given subscriptions left on them, so a wallet
 * shared with a subscription the screen is not about offers nothing it would charge to that one.
 * Unchanged when no subscriptions are given.
 */
export const getWalletBalancesForSubscriptions = (
    walletBalances: CustomerWalletBalanceItem[],
    subscriptions: PricingPlanSubscriptionExpanded[] | undefined,
): CustomerWalletBalanceItem[] => {
    const scheduleIds = new Set(
        (subscriptions ?? []).flatMap(({ pricing_plan_schedule_infos }) =>
            (pricing_plan_schedule_infos ?? []).map(({ id }) => id),
        ),
    );

    if (scheduleIds.size === 0) {
        return walletBalances;
    }

    return walletBalances.map((balance) => ({
        ...balance,
        charge_on_demand_pricing_items: (balance.charge_on_demand_pricing_items ?? []).filter(
            ({ pricing_plan_schedule_id }) =>
                !!pricing_plan_schedule_id && scheduleIds.has(pricing_plan_schedule_id),
        ),
    }));
};
