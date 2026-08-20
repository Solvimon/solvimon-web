import type { CustomerWalletBalanceItem, WalletBalanceValue } from '@solvimon/solvimon-types';
import { formatWalletBalanceValue, useIntl } from '@solvimon/solvimon-ui';

/**
 * Wallet figures in the terms the customer reads their balance in: the credits a credit based wallet
 * holds, named as its credit type names them, and money for a wallet that holds money.
 *
 * The formatting util takes the intl helpers rather than reaching for them, so it can be called from
 * either package's context. This hands it this app's, so no call site has to remember to.
 */
export function useWalletBalanceFormat() {
    const { $t, formatNumber } = useIntl();

    const formatValue = (value?: WalletBalanceValue | null) =>
        formatWalletBalanceValue($t, formatNumber, value);

    /** What is left to spend, which is the figure a customer means by "my balance". */
    const formatOpenBalance = (balanceItem?: CustomerWalletBalanceItem) =>
        formatValue(balanceItem?.wallet_balance.open_balance);

    return { formatValue, formatOpenBalance };
}
