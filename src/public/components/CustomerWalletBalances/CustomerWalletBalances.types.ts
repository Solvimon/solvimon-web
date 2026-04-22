import type { WalletBalanceListItem } from '@solvimon/ui';

export interface CustomerWalletBalancesProps {
    hasError: boolean;
    isLoading: boolean;
    walletBalances: WalletBalanceListItem[];
}
