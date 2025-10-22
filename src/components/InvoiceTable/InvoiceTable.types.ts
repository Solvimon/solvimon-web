import type { Invoice } from '@solvimon/types';

export interface InvoiceTableProps {
    invoices: Invoice[];
}

export interface InvoiceTableEmits {
    (e: 'view-invoice', invoiceId: Invoice['id']): void;
    (e: 'pay-invoice', invoiceId: Invoice['id']): void;
}
