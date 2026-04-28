import type { Invoice } from '@solvimon/solvimon-types';

export interface InvoiceTableProps {
    invoices: Invoice[];
    isLoading?: boolean;
    hasMoreItems?: boolean;
    configuration: {
        showPayButton?: boolean;
        showViewButton?: boolean;
    };
}

export interface InvoiceTableEmits {
    (e: 'view-invoice', payload: { invoiceId: Invoice['id'] }): void;
    (e: 'pay-invoice', payload: { invoiceId: Invoice['id'] }): void;
    (e: 'load-more'): void;
}
