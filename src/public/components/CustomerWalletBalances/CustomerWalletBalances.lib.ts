import type {
    ChargeOnDemandPricingItem,
    CustomerWalletBalanceItem,
    OnDemandPricingItemsResponse,
    PricingPlanSubscriptionExpanded,
    WalletBalanceValue,
} from '@solvimon/solvimon-types';
import { getAllPricings, isFlexiblePricing } from '@solvimon/solvimon-ui';
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

/**
 * The balances plus a zero-balance row for each wallet type the plan's choose-your-amount top-ups
 * grant to but the customer has no wallet of yet, so the first top-up can be bought. Such a row
 * has an empty `wallet_id`: there is no wallet to hang an auto top-up rule on until it is bought.
 *
 * shortcut: two such rows share the empty `wallet_id` the ui keys rows on; give them a key of
 * their own if a plan ever grants top-ups to several wallet types the customer lacks.
 */
export const withTopUpWalletsFromPlan = (
    walletBalances: CustomerWalletBalanceItem[],
    onDemandPricingItems: OnDemandPricingItemsResponse | undefined,
): CustomerWalletBalanceItem[] => {
    const offeredItemIds = new Set(
        walletBalances.flatMap(({ charge_on_demand_pricing_items }) =>
            (charge_on_demand_pricing_items ?? []).map(({ pricing_item_id }) => pricing_item_id),
        ),
    );
    const walletTypeIds = new Set(walletBalances.map(({ wallet }) => wallet?.wallet_type_id));
    const newWallets = new Map<string, CustomerWalletBalanceItem>();

    for (const item of getAllPricings(onDemandPricingItems).flatMap(({ items }) => items ?? [])) {
        const config = item.configs?.find(
            (candidate) => candidate.on_demand && isFlexiblePricing(candidate),
        );
        const grant = config?.wallet_grants?.[0];
        const band = config?.details.bands?.[0];
        const currency = band?.minimum_amount?.currency ?? band?.maximum_amount?.currency;
        const creditTypeId =
            grant?.credits_grant?.conversion?.credit_type_id ??
            grant?.credits_grant?.credits?.credit_type_id;

        if (
            !grant ||
            !currency ||
            offeredItemIds.has(item.id) ||
            walletTypeIds.has(grant.wallet_type_id)
        ) {
            continue;
        }

        const zero: WalletBalanceValue = creditTypeId
            ? { credits: { quantity: '0', credit_type_id: creditTypeId } }
            : { amount: { quantity: '0', currency } };
        const wallet = newWallets.get(grant.wallet_type_id) ?? {
            wallet_id: '',
            wallet: null,
            wallet_balance: { balance: zero, open_balance: zero },
            charge_on_demand_pricing_items: [],
        };

        wallet.charge_on_demand_pricing_items?.push({
            pricing_item_id: item.id,
            pricing_plan_schedule_id: onDemandPricingItems?.pricing_plan_schedule_id,
            pricing_item: item,
        });
        newWallets.set(grant.wallet_type_id, wallet);
    }

    return [...walletBalances, ...newWallets.values()];
};
