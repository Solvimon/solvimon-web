import type { Amount, BillingPeriod, Invoice, InvoiceGroup } from '@solvimon/solvimon-types';
import {
    getAnnualizedAmount,
    getCompactQuantity,
    getGroupsSubtotal,
    getInvoiceGroupQuantity,
    getInvoiceGroupName,
    getPeriodRecurringAmount,
    getSavingsAmount,
} from './OrderSummary.lib';

const eur = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

const MONTHLY: BillingPeriod = { type: 'MONTH', value: 1 };
const YEARLY: BillingPeriod = { type: 'YEAR', value: 1 };

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

    it('reports the period total when nothing is charged only once', () => {
        expect(getPeriodRecurringAmount(invoice({ recurring: '100.00' }))).toEqual(eur('100.00'));
    });

    // A preview that prorates a part period before billing a full one must not report the two
    // added together as the price of one of them.
    it('answers for one period, not for every period the preview carries', () => {
        const twoPeriods = {
            billing_currency: 'EUR',
            periods: [
                invoice({ recurring: '33.00', oneOff: '15.00' }).periods[0],
                invoice({ recurring: '100.00', oneOff: '15.00' }).periods[0],
            ],
        } as unknown as Invoice;

        expect(getPeriodRecurringAmount(twoPeriods)).toEqual(eur('33.00'));
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

describe('getInvoiceGroupQuantity', () => {
    const line = (number?: string, pricingItemConfigId = 'pico_1', type = 'REVENUE') => ({
        type,
        pricing_item_config_id: pricingItemConfigId,
        details: number === undefined ? {} : { meter_value: { number } },
    });
    const group = (...lines: ReturnType<typeof line>[]) => ({ lines }) as unknown as InvoiceGroup;

    it('counts a fee without a meter value once', () => {
        expect(getInvoiceGroupQuantity(group(line()))).toBe(1);
    });

    it('adds up the seats of every tier the group bills', () => {
        expect(getInvoiceGroupQuantity(group(line('1'), line('4')))).toBe(5);
    });

    it('keeps a fractional quantity', () => {
        expect(getInvoiceGroupQuantity(group(line('2.5')))).toBe(2.5);
    });

    it('gives no quantity for a discount', () => {
        expect(
            getInvoiceGroupQuantity(group(line(undefined, 'pico_1', 'DISCOUNT'))),
        ).toBeUndefined();
    });

    it('gives no quantity for a group of several prices', () => {
        expect(getInvoiceGroupQuantity(group(line(), line('3', 'pico_2')))).toBeUndefined();
    });
});

describe('getCompactQuantity', () => {
    const format = (value: number) => new Intl.NumberFormat('en-US').format(value);
    const compact = (quantity: number) => getCompactQuantity(quantity, format);

    it('shows a count below a thousand as it is, with nothing more to tell', () => {
        expect(compact(1)).toEqual({ label: '1' });
        expect(compact(999)).toEqual({ label: '999' });
        expect(compact(2.5)).toEqual({ label: '2.5' });
    });

    it('cuts thousands and millions down to whole units, marking what was cut off', () => {
        expect(compact(7228)).toEqual({ label: '7K+', exact: '7,228' });
        expect(compact(15787)).toEqual({ label: '15K+', exact: '15,787' });
        expect(compact(521293)).toEqual({ label: '521K+', exact: '521,293' });
        expect(compact(9592920)).toEqual({ label: '9M+', exact: '9,592,920' });
        expect(compact(999950)).toEqual({ label: '999K+', exact: '999,950' });
    });

    it('marks nothing as cut off from an exact thousand or million', () => {
        expect(compact(1000)).toEqual({ label: '1K', exact: '1,000' });
        expect(compact(13000000)).toEqual({ label: '13M', exact: '13,000,000' });
    });

    it('uses B from a billion on, so a count never takes more than three digits', () => {
        expect(compact(1234567890)).toEqual({ label: '1B+', exact: '1,234,567,890' });
    });
});
