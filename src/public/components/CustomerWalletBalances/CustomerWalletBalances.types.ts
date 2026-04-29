import type { WalletBalanceListItem } from '@solvimon/solvimon-ui';

export interface CustomerWalletBalancesProps {
    hasError: boolean;
    isLoading: boolean;
    walletBalances: WalletBalanceListItem[];
}
