import type { Amount } from '@solvimon/solvimon-types';

export function toMinorUnitAmount(amount: Amount): { value: number; currency: string } {
    const formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: amount.currency,
    });

    const { maximumFractionDigits = 10 } = formatter.resolvedOptions();

    return {
        value: Math.round(+amount.quantity * Math.pow(10, maximumFractionDigits)),
        currency: amount.currency,
    };
}

const decimalPlaces = (quantity: string): number => quantity.split('.')[1]?.length ?? 0;

/**
 * Amounts summed as integers in the smallest unit the operands themselves use, because adding the
 * quantities as floats drifts: `0.1 + 0.2` is not `0.3`, and a total that is off by a cent from
 * the one the customer is charged is worse than no total at all.
 */
export function sumAmounts(amounts: Amount[], currency: string): Amount {
    const quantities = amounts
        .map(({ quantity }) => quantity)
        .filter((quantity) => Number.isFinite(Number(quantity)));
    const scale = quantities.reduce((max, quantity) => Math.max(max, decimalPlaces(quantity)), 2);
    const factor = 10 ** scale;
    const total = quantities.reduce(
        (sum, quantity) => sum + Math.round(Number(quantity) * factor),
        0,
    );

    return { quantity: (total / factor).toFixed(scale), currency };
}
