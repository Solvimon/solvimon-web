import type { Amount, Invoice, InvoiceGroup, InvoiceLine } from '@solvimon/solvimon-types';
import {
    getInvoiceGroupsByRecurrence,
    isInvoiceUsageBased,
    splitInvoiceByRecurrence,
} from './invoice';

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

    it('returns false for a period that carries no groups', () => {
        expect(isInvoiceUsageBased({ periods: [{}] } as unknown as Invoice)).toBe(false);
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

    // The shape the API actually returns for a one-off: both the group and the line say REVENUE,
    // and the only thing that says the charge will not come back is the product item's model type.
    it('reads a one-off charge the API types REVENUE all the way down', () => {
        const result = splitInvoiceByRecurrence({
            billing_currency: 'EUR',
            periods: [
                {
                    groups: [
                        {
                            type: 'REVENUE',
                            amount_excluding_tax: eur('15.00'),
                            amount_including_tax: eur('18.15'),
                            lines: [
                                {
                                    type: 'REVENUE',
                                    pricing_type: 'FIXED',
                                    product_items: [{ model_type: 'ONE_OFF' }],
                                    amount_excluding_tax: eur('15.00'),
                                    amount_including_tax: eur('18.15'),
                                },
                            ],
                        },
                    ],
                },
            ],
        } as unknown as Invoice);

        expect(result.oneOff.includingTax).toEqual(eur('18.15'));
        expect(result.recurring.includingTax).toEqual(eur('0.00'));
        expect(result.hasOneOff).toBe(true);
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

describe('getInvoiceGroupsByRecurrence', () => {
    const eur = (quantity: string): Amount => ({ quantity, currency: 'EUR' });

    const line = (modelType: string) =>
        ({
            type: 'REVENUE',
            product_items: [{ model_type: modelType }],
            amount_excluding_tax: eur('10.00'),
            amount_including_tax: eur('10.00'),
        }) as unknown as InvoiceLine;

    const invoice = (groups: unknown[]) =>
        ({ billing_currency: 'EUR', periods: [{ groups }] }) as unknown as Invoice;

    it('puts each group on the side its lines charge from', () => {
        const result = getInvoiceGroupsByRecurrence(
            invoice([
                { type: 'REVENUE', pricing: { name: 'Seats' }, lines: [line('PER_SEAT')] },
                { type: 'REVENUE', pricing: { name: 'Shipping' }, lines: [line('ONE_OFF')] },
            ]),
        );

        expect(result.recurring.map((group) => group.pricing?.name)).toEqual(['Seats']);
        expect(result.oneOff.map((group) => group.pricing?.name)).toEqual(['Shipping']);
    });

    // A row carries the group's own amount, so a group that is both cannot be filed under either
    // heading without the number beneath it contradicting the heading.
    it('keeps a group whose lines disagree where every group used to be', () => {
        const result = getInvoiceGroupsByRecurrence(
            invoice([
                {
                    type: 'REVENUE',
                    pricing: { name: 'Mixed' },
                    lines: [line('PER_SEAT'), line('ONE_OFF')],
                },
            ]),
        );

        expect(result.recurring).toHaveLength(1);
        expect(result.oneOff).toHaveLength(0);
    });

    it('falls back to the group type when a preview does not expand its lines', () => {
        const result = getInvoiceGroupsByRecurrence(
            invoice([
                { type: 'ONE_OFF', pricing: { name: 'Top-up' } },
                { type: 'REVENUE', pricing: { name: 'Plan' } },
            ]),
        );

        expect(result.oneOff.map((group) => group.pricing?.name)).toEqual(['Top-up']);
        expect(result.recurring.map((group) => group.pricing?.name)).toEqual(['Plan']);
    });

    it('reports nothing for an invoice with no periods', () => {
        expect(getInvoiceGroupsByRecurrence({} as Invoice)).toEqual({ recurring: [], oneOff: [] });
    });
});
