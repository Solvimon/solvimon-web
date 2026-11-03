import type { Invoice } from '@solvimon/solvimon-types';

export interface InvoiceOrderSummaryProps {
    invoice: Invoice;
    isPaid?: boolean;
}
