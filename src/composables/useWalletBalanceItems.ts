import type { CustomerWalletBalancesResponse } from '@solvimon/solvimon-types';
import { computed, type ComputedRef } from 'vue';
import { useIntl, type WalletBalanceListItem } from '@solvimon/solvimon-ui';

interface WalletBalancesSource {
    readonly value: CustomerWalletBalancesResponse | null;
}

export function useWalletBalanceItems(
    walletBalances: WalletBalancesSource,
): ComputedRef<WalletBalanceListItem[]> {
    const { $t } = useIntl();

    return computed(() =>
        (walletBalances.value?.wallet_balances ?? []).map((walletBalance) => {
            return {
                walletId: walletBalance.wallet_id,
                title: $t({
                    defaultMessage: 'Balance',
                    description: 'Fallback wallet title in wallet balance components',
                    id: 'H5+NAX',
                }),
                balance: walletBalance.wallet_balance.open_balance,
                balanceAt:
                    walletBalance.wallet_balance.balance_at ??
                    walletBalances.value?.balance_at ??
                    null,
            } satisfies WalletBalanceListItem;
        }),
    );
}
