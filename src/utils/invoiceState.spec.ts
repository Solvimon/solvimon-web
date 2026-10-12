import type { Invoice } from '@solvimon/solvimon-types';
import { getInvoiceTimezone, isInvoicePayable } from './invoiceState';

describe('isInvoicePayable', () => {
    const payable = {
        status: 'FINAL',
        type: 'STANDARD',
        paid: false,
        payment_status: 'UNPAID',
        open_invoice_amount: { quantity: '20.00', currency: 'EUR' },
    } as Invoice;

    it('is payable when final, unpaid and with an amount left open', () => {
        expect(isInvoicePayable(payable)).toBe(true);
    });

    it('is payable for a one-off invoice and for one without a type', () => {
        expect(isInvoicePayable({ ...payable, type: 'ONE_OFF' })).toBe(true);
        expect(isInvoicePayable({ ...payable, type: undefined } as unknown as Invoice)).toBe(true);
    });

    it.each(['DRAFT', 'OPEN', 'EMPTY', 'VOID'] as const)('is not payable when %s', (status) => {
        expect(isInvoicePayable({ ...payable, status })).toBe(false);
    });

    it.each(['CREDIT', 'ONE_OFF_CREDIT'] as const)('is not payable for a %s note', (type) => {
        expect(isInvoicePayable({ ...payable, type })).toBe(false);
    });

    it.each(['0.00', '-5.00'])('is not payable with %s left open', (quantity) => {
        expect(
            isInvoicePayable({ ...payable, open_invoice_amount: { quantity, currency: 'EUR' } }),
        ).toBe(false);
    });

    it('is not payable once paid, whichever field says so', () => {
        expect(isInvoicePayable({ ...payable, paid: true })).toBe(false);
        expect(isInvoicePayable({ ...payable, paid: null, payment_status: 'PAID' })).toBe(false);
        expect(isInvoicePayable({ ...payable, paid: null, payment_status: 'OVERPAID' })).toBe(
            false,
        );
    });

    it('is still payable when only part of it was paid', () => {
        expect(isInvoicePayable({ ...payable, payment_status: 'PARTIALLY_PAID' })).toBe(true);
    });
});

describe('getInvoiceTimezone', () => {
    it("prefers the invoice's own timezone over the customer's", () => {
        expect(
            getInvoiceTimezone({
                timezone: 'America/New_York',
                customer: { timezone: 'Europe/Amsterdam' },
            } as Invoice),
        ).toBe('America/New_York');
    });

    it("falls back to the customer's timezone when the invoice has none", () => {
        expect(
            getInvoiceTimezone({
                customer: { timezone: 'Europe/Amsterdam' },
            } as Invoice),
        ).toBe('Europe/Amsterdam');
    });
});
