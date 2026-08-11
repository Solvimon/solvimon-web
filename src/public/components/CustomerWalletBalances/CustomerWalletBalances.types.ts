import type { CustomerWalletBalanceItem } from '@solvimon/solvimon-types';

export interface CustomerWalletBalancesProps {
    hasError: boolean;
    isLoading: boolean;
    walletBalances: CustomerWalletBalanceItem[];
    /**
     * Whether topping up is offered at all. Per wallet the button only shows when that wallet has
     * on-demand pricing items to charge.
     */
    showTopUpButton?: boolean;
}

export interface CustomerWalletBalancesEmits {
    /** The customer asked to top up this wallet. */
    (e: 'top-up', walletBalanceItem: CustomerWalletBalanceItem): void;
}
