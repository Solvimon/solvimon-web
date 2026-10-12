import type { Invoice } from '@solvimon/solvimon-types';

const CREDIT_INVOICE_TYPES: ReadonlyArray<Invoice['type']> = ['CREDIT', 'ONE_OFF_CREDIT'];

export const isCreditInvoice = (invoice: Pick<Invoice, 'type'>): boolean =>
    CREDIT_INVOICE_TYPES.includes(invoice.type);

export const isInvoicePaid = (invoice: Pick<Invoice, 'paid' | 'payment_status'>): boolean =>
    !!invoice.paid || invoice.payment_status === 'PAID' || invoice.payment_status === 'OVERPAID';

/**
 * Mirrors what the API accepts for a payment: it refuses any invoice that is not FINAL, and one
 * with nothing left open. A draft that is on hold is therefore never payable either.
 */
export const isInvoicePayable = (
    invoice: Pick<Invoice, 'status' | 'type' | 'open_invoice_amount' | 'paid' | 'payment_status'>,
): boolean =>
    invoice.status === 'FINAL' &&
    !isCreditInvoice(invoice) &&
    !isInvoicePaid(invoice) &&
    Number(invoice.open_invoice_amount?.quantity ?? 0) > 0;

/** The invoice's own dates are set in the timezone it was issued in, which the customer's can drift from. */
export const getInvoiceTimezone = (invoice: Pick<Invoice, 'timezone' | 'customer'>): string =>
    invoice.timezone || invoice.customer.timezone;

/**
 * For library components that date an invoice in `invoice.customer.timezone`: hands them the
 * invoice's own timezone there, so every date on one invoice agrees.
 */
export const withInvoiceTimezone = <T extends Pick<Invoice, 'timezone' | 'customer'>>(
    invoice: T,
): T => ({
    ...invoice,
    customer: { ...invoice.customer, timezone: getInvoiceTimezone(invoice) },
});
