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
