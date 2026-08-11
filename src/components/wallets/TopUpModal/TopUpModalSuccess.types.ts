import type { Invoice, WalletBalanceValue } from '@solvimon/solvimon-types';

export interface TopUpModalSuccessProps {
    /**
     * What the top-up added to the wallet, the way the customer reads their balance — credits for a
     * credit based wallet, money otherwise. Undefined when it could not be worked out, in which case
     * the receipt is left to speak for itself.
     */
    addedValue?: WalletBalanceValue;
    /** The invoice the charge produced, shown as the receipt for it. */
    invoice?: Invoice;
}
