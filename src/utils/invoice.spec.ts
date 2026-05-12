import type { Invoice } from '@solvimon/solvimon-types';
import { isInvoiceUsageBased } from './invoice';

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
