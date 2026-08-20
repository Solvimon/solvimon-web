import type { Amount } from '@solvimon/solvimon-types';
import type { ConversionBase } from './ConvertedAmountInput.types';

export const toNumber = (quantity?: string | null): number | undefined => {
    const parsed = Number(quantity);

    return quantity !== null && quantity !== undefined && quantity !== '' && Number.isFinite(parsed)
        ? parsed
        : undefined;
};

export const toConvertedQuantity = (
    quantity: string | null | undefined,
    base: ConversionBase,
    conversionRate?: string,
): number | undefined => {
    const value = toNumber(quantity);
    const rate = toNumber(conversionRate);

    if (value === undefined || rate === undefined || rate <= 0) {
        return undefined;
    }

    return base === 'CREDITS' ? value / rate : value * rate;
};

export const toOtherBase = (
    quantity: string | null | undefined,
    from: ConversionBase,
    to: ConversionBase,
    conversionRate?: string,
): number | undefined =>
    from === to ? toNumber(quantity) : toConvertedQuantity(quantity, from, conversionRate);

/**
 * A bound as the customer enters it. Bounds are configured in money, since money is what a top-up
 * charges — so a customer entering credits has to be told them in credits before they can be read
 * against what is in the field.
 *
 * The money-to-credits direction is the one a money quantity converts in, hence `AMOUNT` for a bound
 * that is being restated in credits.
 */
export const toBaseQuantity = (
    quantity: string | undefined,
    base: ConversionBase,
    conversionRate?: string,
): number | undefined =>
    base === 'CREDITS'
        ? toConvertedQuantity(quantity, 'AMOUNT', conversionRate)
        : toNumber(quantity);

export const toMoneyQuantity = (value: number): string => value.toFixed(2);

export const toFieldQuantity = (value: number, base: ConversionBase): string =>
    base === 'AMOUNT' ? toMoneyQuantity(value) : String(Number(value.toFixed(6)));

export const toBoundQuantity = (
    bound: Amount | undefined,
    base: ConversionBase,
    conversionRate: string | undefined,
    formatNumber: (value: number) => string,
): string | undefined => {
    const quantity = toBaseQuantity(bound?.quantity, base, conversionRate);

    if (quantity === undefined) {
        return undefined;
    }

    return base === 'CREDITS' ? formatNumber(quantity) : toMoneyQuantity(quantity);
};
