import type { Amount } from '@solvimon/solvimon-types';
import type { AmountInputModelValue } from '@solvimon/solvimon-ui';
import type {
    AutoTopUpConfigFormState,
    AutoTopUpDenomination,
    AutoTopUpRule,
} from './AutoTopUpConfig.types';

export const getThresholdUnit = (
    denomination: AutoTopUpDenomination,
    creditUnitName?: string,
): string => denomination.currency ?? creditUnitName ?? denomination.creditTypeId ?? '';

export interface AutoTopUpFormContext {
    denomination: AutoTopUpDenomination;
    chargeCurrency: string;
    creditUnitName?: string;
    /** A rule with no amount yet opens on it, being the one figure certain to be accepted. */
    minimumTopUp?: string;
}

const toInputValue = (quantity: string | undefined, unit: string): AmountInputModelValue => ({
    quantity: quantity ?? null,
    currency: unit,
});

export const toFormState = (
    rule: AutoTopUpRule | undefined,
    { denomination, chargeCurrency, creditUnitName, minimumTopUp }: AutoTopUpFormContext,
): AutoTopUpConfigFormState => ({
    enabled: rule?.status === 'ACTIVE',
    threshold: toInputValue(
        rule?.threshold?.amount?.quantity ?? rule?.threshold?.credits?.quantity,
        getThresholdUnit(denomination, creditUnitName),
    ),
    topUpAmount: toInputValue(rule?.topup_amount?.quantity ?? minimumTopUp, chargeCurrency),
});

/** An emptied field is no threshold, not a zero — which reads as "top up when it hits nothing". */
export const toThreshold = (
    state: AutoTopUpConfigFormState,
    denomination: AutoTopUpDenomination,
): AutoTopUpRule['threshold'] => {
    const quantity = state.threshold?.quantity;

    if (!quantity) {
        return {};
    }

    return denomination.creditTypeId
        ? { credits: { quantity, credit_type_id: denomination.creditTypeId } }
        : { amount: { quantity, currency: denomination.currency ?? '' } };
};

/** An emptied field is no amount, not a zero — which the endpoint reads as adding nothing. */
export const toTopUpAmount = (
    state: AutoTopUpConfigFormState,
    chargeCurrency: string,
): AutoTopUpRule['topup_amount'] =>
    state.topUpAmount?.quantity
        ? {
              quantity: state.topUpAmount.quantity,
              currency: state.topUpAmount.currency ?? chargeCurrency,
          }
        : undefined;

export const toAutoTopUpRule = (
    state: AutoTopUpConfigFormState,
    { denomination, chargeCurrency }: Pick<AutoTopUpFormContext, 'denomination' | 'chargeCurrency'>,
): AutoTopUpRule => ({
    status: state.enabled ? 'ACTIVE' : 'INACTIVE',
    threshold: toThreshold(state, denomination),
    ...(toTopUpAmount(state, chargeCurrency) && {
        topup_amount: toTopUpAmount(state, chargeCurrency),
    }),
});

export const normalizeAutoTopUpRule = (
    rule: AutoTopUpRule | undefined,
    context: AutoTopUpFormContext,
): AutoTopUpRule => toAutoTopUpRule(toFormState(rule, context), context);

/** Compared as text: both sides come out of `toAutoTopUpRule`, so their keys are ordered alike. */
export const isSameAutoTopUpRule = (a: AutoTopUpRule, b: AutoTopUpRule): boolean =>
    JSON.stringify(a) === JSON.stringify(b);

export const toQuantity = (value: AmountInputModelValue | undefined): number | undefined => {
    const quantity = Number(value?.quantity);

    return value?.quantity && Number.isFinite(quantity) ? quantity : undefined;
};

/** An empty field passes: the required rule owns emptiness, and so does an unbounded pricing. */
export const isAtLeastMinimum = (value: number | null, minimum?: Amount): boolean => {
    const bound = Number(minimum?.quantity);

    return value === null || !minimum?.quantity || !Number.isFinite(bound) || value >= bound;
};

export const isWithinMaximum = (value: number | null, maximum?: Amount): boolean => {
    const bound = Number(maximum?.quantity);

    return value === null || !maximum?.quantity || !Number.isFinite(bound) || value <= bound;
};
