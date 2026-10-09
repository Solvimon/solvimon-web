import type { Amount, Invoice, InvoiceGroup, InvoiceLine } from '@solvimon/solvimon-types';
import { isInvoiceUsageBased, splitInvoiceByRecurrence } from './invoice';

const makeInvoice = (modelType: string): Invoice =>
    ({
        periods: [
            {
                groups: [
                    {
                        lines: [
                            {
                                product_items: [{ model_type: modelType }],
                            },
                        ],
                    },
                ],
            },
        ],
    }) as unknown as Invoice;

describe('isInvoiceUsageBased', () => {
    it('returns true when any product item has model_type USAGE_BASED', () => {
        expect(isInvoiceUsageBased(makeInvoice('USAGE_BASED'))).toBe(true);
    });

    it('returns false when no product item has model_type USAGE_BASED', () => {
        expect(isInvoiceUsageBased(makeInvoice('FLAT_FEE'))).toBe(false);
    });

    it('returns false when periods is undefined', () => {
        expect(isInvoiceUsageBased({} as Invoice)).toBe(false);
    });

    it('returns false when periods is an empty array', () => {
        expect(isInvoiceUsageBased({ periods: [] } as unknown as Invoice)).toBe(false);
    });

    it('returns true when only one of multiple product items is USAGE_BASED', () => {
        const invoice = {
            periods: [
                {
                    groups: [
                        {
                            lines: [
                                {
                                    product_items: [
                                        { model_type: 'FLAT_FEE' },
                                        { model_type: 'USAGE_BASED' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        } as unknown as Invoice;
        expect(isInvoiceUsageBased(invoice)).toBe(true);
    });
});

describe('splitInvoiceByRecurrence', () => {
    const eur = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

    const line = ({
        modelTypes = ['RECURRING'],
        type = 'PRICING',
        excluding,
        including,
    }: {
        modelTypes?: string[];
        type?: string;
        excluding: string;
        including: string;
    }) =>
        ({
            type,
            product_items: modelTypes.map((model_type) => ({ model_type })),
            amount_excluding_tax: eur(excluding),
            amount_including_tax: eur(including),
        }) as unknown as InvoiceLine;

    const group = ({
        type = 'PRICING',
        lines,
        excluding,
        including,
    }: {
        type?: string;
        lines?: InvoiceLine[];
        excluding?: string;
        including?: string;
    }) =>
        ({
            type,
            ...(lines ? { lines } : {}),
            ...(excluding ? { amount_excluding_tax: eur(excluding) } : {}),
            ...(including ? { amount_including_tax: eur(including) } : {}),
        }) as unknown as InvoiceGroup;

    const invoice = (groups: InvoiceGroup[], billingCurrency = 'EUR'): Invoice =>
        ({
            billing_currency: billingCurrency,
            periods: [{ groups }],
        }) as unknown as Invoice;

    it('splits a first invoice into what repeats and what does not', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    lines: [
                        line({
                            modelTypes: ['PER_SEAT'],
                            excluding: '400.00',
                            including: '484.00',
                        }),
                    ],
                }),
                group({
                    lines: [
                        line({ modelTypes: ['ONE_OFF'], excluding: '15.00', including: '18.15' }),
                    ],
                }),
            ]),
        );

        expect(result.recurring).toEqual({
            excludingTax: eur('400.00'),
            includingTax: eur('484.00'),
        });
        expect(result.oneOff).toEqual({ excludingTax: eur('15.00'), includingTax: eur('18.15') });
        expect(result.hasOneOff).toBe(true);
        expect(result.hasUnattributed).toBe(false);
    });

    it('reads a one-off line out of a group the API still types as PRICING', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    type: 'PRICING',
                    lines: [
                        line({ modelTypes: ['ONE_OFF'], excluding: '20.00', including: '24.20' }),
                    ],
                }),
            ]),
        );

        expect(result.oneOff.includingTax).toEqual(eur('24.20'));
        expect(result.recurring.includingTax).toEqual(eur('0.00'));
    });

    it('treats a line that charges for anything repeating as recurring', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    lines: [
                        line({
                            modelTypes: ['ONE_OFF', 'PER_SEAT'],
                            excluding: '100.00',
                            including: '121.00',
                        }),
                    ],
                }),
            ]),
        );

        expect(result.recurring.includingTax).toEqual(eur('121.00'));
        expect(result.hasOneOff).toBe(false);
    });

    it('lets an ONE_OFF line type settle it regardless of the product items', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    lines: [
                        line({
                            type: 'ONE_OFF',
                            modelTypes: ['RECURRING'],
                            excluding: '50.00',
                            including: '60.50',
                        }),
                    ],
                }),
            ]),
        );

        expect(result.oneOff.includingTax).toEqual(eur('60.50'));
    });

    it('falls back to the group type when a preview does not expand its lines', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({ type: 'PRICING', excluding: '400.00', including: '484.00' }),
                group({ type: 'ONE_OFF', excluding: '15.00', including: '18.15' }),
            ]),
        );

        expect(result.recurring.includingTax).toEqual(eur('484.00'));
        expect(result.oneOff.includingTax).toEqual(eur('18.15'));
    });

    it('puts a charge it cannot attribute aside instead of on either side', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    type: 'PRICING',
                    lines: [line({ excluding: '400.00', including: '484.00' })],
                }),
                group({ type: 'DISCOUNT', excluding: '-40.00', including: '-48.40' }),
            ]),
        );

        expect(result.recurring.includingTax).toEqual(eur('484.00'));
        expect(result.unattributed.includingTax).toEqual(eur('-48.40'));
        expect(result.hasUnattributed).toBe(true);
    });

    it('sums without the drift adding the quantities as floats would introduce', () => {
        const result = splitInvoiceByRecurrence(
            invoice([
                group({
                    lines: [
                        line({ excluding: '0.10', including: '0.10' }),
                        line({ excluding: '0.20', including: '0.20' }),
                    ],
                }),
            ]),
        );

        expect(result.recurring.excludingTax).toEqual(eur('0.30'));
    });

    it('reports zero in the invoice currency when there is nothing to split', () => {
        const result = splitInvoiceByRecurrence({
            billing_currency: 'GBP',
            periods: [],
        } as unknown as Invoice);

        expect(result.recurring.includingTax).toEqual({ quantity: '0.00', currency: 'GBP' });
        expect(result.hasOneOff).toBe(false);
        expect(result.hasUnattributed).toBe(false);
    });

    it('reports zero when the invoice has no periods at all', () => {
        const result = splitInvoiceByRecurrence({ billing_currency: 'EUR' } as unknown as Invoice);

        expect(result.oneOff.excludingTax).toEqual(eur('0.00'));
    });
});
