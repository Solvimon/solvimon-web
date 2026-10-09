import type { Amount, BillingPeriod, Invoice, InvoiceGroup } from '@solvimon/solvimon-types';
import {
    getAnnualizedAmount,
    getGroupsSubtotal,
    getInvoiceGroupName,
    getPeriodRecurringAmount,
    getSavingsAmount,
} from './OrderSummary.lib';

const eur = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

const MONTHLY: BillingPeriod = { type: 'MONTH', value: 1 };
const YEARLY: BillingPeriod = { type: 'YEAR', value: 1 };

/** An invoice of one recurring line and, where given, a one-off charged alongside it. */
const invoice = ({ recurring, oneOff }: { recurring: string; oneOff?: string }): Invoice => {
    const total = (Number(recurring) + Number(oneOff ?? '0')).toFixed(2);

    return {
        billing_currency: 'EUR',
        periods: [
            {
                amount_including_tax: eur(total),
                groups: [
                    {
                        type: 'REVENUE',
                        lines: [
                            {
                                type: 'REVENUE',
                                product_items: [{ model_type: 'PER_SEAT' }],
                                amount_excluding_tax: eur(recurring),
                                amount_including_tax: eur(recurring),
                            },
                            ...(oneOff
                                ? [
                                      {
                                          type: 'REVENUE',
                                          product_items: [{ model_type: 'ONE_OFF' }],
                                          amount_excluding_tax: eur(oneOff),
                                          amount_including_tax: eur(oneOff),
                                      },
                                  ]
                                : []),
                        ],
                    },
                ],
            },
        ],
    } as unknown as Invoice;
};

describe('getPeriodRecurringAmount', () => {
    it('leaves out what the invoice charges only once', () => {
        expect(getPeriodRecurringAmount(invoice({ recurring: '100.00', oneOff: '15.00' }))).toEqual(
            eur('100.00'),
        );
    });

    // An invoice with nothing one-off on it keeps reporting its period total, as it always did.
    it('reports the period total when nothing is charged only once', () => {
        expect(getPeriodRecurringAmount(invoice({ recurring: '100.00' }))).toEqual(eur('100.00'));
    });

    it('reports nothing for a period with no preview of its own', () => {
        expect(getPeriodRecurringAmount(undefined)).toBeUndefined();
    });

    it('reports nothing when part of the invoice fits neither side', () => {
        const withInvoiceWideDiscount = {
            billing_currency: 'EUR',
            periods: [
                {
                    amount_including_tax: eur('95.00'),
                    groups: [
                        {
                            type: 'REVENUE',
                            lines: [
                                {
                                    type: 'REVENUE',
                                    product_items: [{ model_type: 'ONE_OFF' }],
                                    amount_excluding_tax: eur('15.00'),
                                    amount_including_tax: eur('15.00'),
                                },
                            ],
                        },
                        {
                            type: 'DISCOUNT',
                            amount_excluding_tax: eur('-20.00'),
                            amount_including_tax: eur('-20.00'),
                        },
                    ],
                },
            ],
        } as unknown as Invoice;

        expect(getPeriodRecurringAmount(withInvoiceWideDiscount)).toBeUndefined();
    });
});

describe('getAnnualizedAmount', () => {
    it.each([
        [{ type: 'MONTH', value: 1 } as BillingPeriod, '10.00', '120.00'],
        [{ type: 'MONTH', value: 3 } as BillingPeriod, '30.00', '120.00'],
        [{ type: 'YEAR', value: 1 } as BillingPeriod, '100.00', '100.00'],
        [{ type: 'WEEK', value: 2 } as BillingPeriod, '10.00', '260.00'],
        [{ type: 'DAY', value: 1 } as BillingPeriod, '1.00', '365.00'],
    ])('converts %o of %s into %s a year', (period, quantity, expected) => {
        expect(getAnnualizedAmount(period, eur(quantity))).toEqual(eur(expected));
    });

    it('reports nothing without an amount to convert', () => {
        expect(getAnnualizedAmount(MONTHLY)).toBeUndefined();
    });
});

describe('getSavingsAmount', () => {
    it('reports the difference when there is one to report', () => {
        expect(getSavingsAmount(eur('120.00'), eur('100.00'))).toEqual(eur('20.00'));
    });

    it('reports nothing when the cheaper option is the one already chosen', () => {
        expect(getSavingsAmount(eur('100.00'), eur('120.00'))).toBeUndefined();
        expect(getSavingsAmount(eur('100.00'), eur('100.00'))).toBeUndefined();
    });
});

// The defect the three are here for: a delivery charged once either way counted itself twelve
// times down the monthly leg and once down the yearly, inventing savings nobody would ever make.
describe('a one-off charged alongside the subscription', () => {
    const annualDifference = (monthly: Invoice, yearly: Invoice) =>
        getSavingsAmount(
            getAnnualizedAmount(MONTHLY, getPeriodRecurringAmount(monthly)),
            getAnnualizedAmount(YEARLY, getPeriodRecurringAmount(yearly)),
        );

    it('makes no difference to what a longer billing period saves', () => {
        const withoutOneOff = annualDifference(
            invoice({ recurring: '10.00' }),
            invoice({ recurring: '100.00' }),
        );
        const withOneOff = annualDifference(
            invoice({ recurring: '10.00', oneOff: '15.00' }),
            invoice({ recurring: '100.00', oneOff: '15.00' }),
        );

        expect(withoutOneOff).toEqual(eur('20.00'));
        expect(withOneOff).toEqual(withoutOneOff);
    });
});

describe('getInvoiceGroupName', () => {
    const group = (fields: Record<string, unknown>) => fields as unknown as InvoiceGroup;

    it('names a group by its pricing', () => {
        expect(getInvoiceGroupName(group({ pricing: { name: 'Standard Shipping' } }))).toBe(
            'Standard Shipping',
        );
    });

    it('falls back to the products when the pricing carries no name', () => {
        expect(
            getInvoiceGroupName(
                group({
                    pricing: { name: '' },
                    products: [{ name: 'PAX A35' }, { name: 'Stand' }],
                }),
            ),
        ).toContain('PAX A35');
    });

    it('names a group it can read nothing off as nothing', () => {
        expect(getInvoiceGroupName(group({}))).toBe('');
    });
});

describe('getGroupsSubtotal', () => {
    const group = (quantity: string) =>
        ({ amount_excluding_tax: eur(quantity) }) as unknown as InvoiceGroup;

    it('adds the groups up on the basis the rows beside it are shown on', () => {
        expect(getGroupsSubtotal([group('400.00'), group('15.00')], 'EUR')).toEqual(eur('415.00'));
    });

    it('reports zero in the given currency for no groups at all', () => {
        expect(getGroupsSubtotal([], 'GBP')).toEqual({ quantity: '0.00', currency: 'GBP' });
    });
});
