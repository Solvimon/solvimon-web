import type { Amount, Credits, WalletAutoTopUpConfig } from '@solvimon/solvimon-types';
import type { AmountInputModelValue } from '@solvimon/solvimon-ui';
import type { FlexibleTopUpBounds } from '@/components/wallets/ConvertedAmountInput/ConvertedAmountInput.types';

/** Mirrors `WalletAutoTopUpConfig['threshold']`, which declares both fields but carries only one. */
export type AutoTopUpDenomination =
    | { currency: Amount['currency']; creditTypeId?: undefined }
    | { creditTypeId: Credits['credit_type_id']; currency?: undefined };

/**
 * The part of a rule this form owns. The rest of `WalletAutoTopUpConfig` — which wallet, which
 * pricing item, which method pays — is context it is used inside, which is what lets the same form
 * sit in both wallet modals.
 */
export interface AutoTopUpRule {
    status: WalletAutoTopUpConfig['status'];
    threshold: WalletAutoTopUpConfig['threshold'];
    /** Always money, even where the threshold is credits: the credits are what the charge grants. */
    topup_amount?: Amount;
}

/** Amounts are the input's own model, so a field can be emptied while its unit stays put. */
export interface AutoTopUpConfigFormState {
    enabled: boolean;
    threshold?: AmountInputModelValue;
    topUpAmount?: AmountInputModelValue;
}

export interface AutoTopUpConfigProps {
    /** Absent means the wallet has never had a rule. */
    config?: AutoTopUpRule;
    denomination: AutoTopUpDenomination;
    /** Falls back to the credit type's id, which is at least stable. */
    creditUnitName?: string;
    chargeCurrency: Amount['currency'];
    /** Credits per unit of money. Left out, the fields stand alone rather than restating each other. */
    conversionRate?: string;
    topUpBounds?: FlexibleTopUpBounds;
    /**
     * Says what the threshold comes to in money. Noise beside a top-up being charged, where the cost
     * on the customer's mind is already totalled for them.
     *
     * @default true
     */
    showThresholdConversion?: boolean;
    /** Draws the rule in a bordered grey panel, for a caller where it is one block among others. */
    contained?: boolean;
    /** Leaves out the on/off switch and treats the rule as on. */
    alwaysEnabled?: boolean;
    disabled?: boolean;
}

export interface AutoTopUpConfigEmits {
    (e: 'save', rule: AutoTopUpRule): void;
}

/** Bundled so the two hosts offering the editor cannot drift on what they pass it. */
export type AutoTopUpEditorConfig = Pick<
    AutoTopUpConfigProps,
    'denomination' | 'creditUnitName' | 'chargeCurrency' | 'conversionRate' | 'topUpBounds'
>;
