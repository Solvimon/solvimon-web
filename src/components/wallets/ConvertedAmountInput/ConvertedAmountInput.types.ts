import type { Amount } from '@solvimon/solvimon-types';
import type { InputProps } from '@solvimon/solvimon-ui';

export type ConversionBase = 'AMOUNT' | 'CREDITS';

/** Money on both ends: it is the charge that is bounded, whatever the wallet counts its balance in. */
export interface FlexibleTopUpBounds {
    minimum?: Amount;
    maximum?: Amount;
}

export interface ConvertedAmountInputProps extends Pick<
    InputProps,
    'label' | 'name' | 'required' | 'disabled' | 'error'
> {
    /** Shown after the field: a currency code, or a credits unit name. */
    unit: string;
    /** A top-up is charged in money whatever the wallet holds, so a field feeding one models money. */
    modelBase: ConversionBase;
    /**
     * What the customer types in. Where it differs from the model, the field converts both ways:
     * they count in their wallet's terms while the model stays what the caller submits.
     *
     * @default modelBase
     */
    entryBase?: ConversionBase;
    /** Credits per unit of money — `credits = amount × rate`, as the wallet grant configures it. */
    conversionRate?: string;
    /** Says what was entered in the other unit, under the field. */
    showConversionHint?: boolean;
    currency?: Amount['currency'];
    creditUnitName?: string;
    /**
     * Stated in the unit the customer types in, since a range they cannot compare to what they
     * entered is no help. Shown rather than enforced — the form it sits in refuses the rule.
     */
    bounds?: FlexibleTopUpBounds;
}
